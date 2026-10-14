import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { MAX_ATTACHMENT_BYTES, safeFileName, sniffAttachment, type AttachmentKind } from "./attachment-file";

const MAX_FILES_PER_WORKSPACE = 100;
const IN_USE = ["draft", "approved", "sending"];

/** Files the owner uploads to send over WhatsApp. Kept on disk under ATTACHMENTS_DIR/<workspaceId>; mount it as a volume in production. */
@Injectable()
export class AttachmentService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private root() {
    return this.config.get<string>("ATTACHMENTS_DIR") || join(process.cwd(), ".attachments");
  }

  async save(workspaceId: string, file: { originalname: string; buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException("The file is empty");
    if (file.buffer.length > MAX_ATTACHMENT_BYTES) throw new BadRequestException(`The file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`);
    const kind = sniffAttachment(file.buffer, file.originalname);
    if (!kind) throw new BadRequestException("Only PDF, JPG, PNG, WebP, MP4, DOCX, XLSX and PPTX files can be attached");
    if ((await this.prisma.messageAttachment.count({ where: { workspaceId } })) >= MAX_FILES_PER_WORKSPACE) throw new BadRequestException(`You can keep up to ${MAX_FILES_PER_WORKSPACE} files. Delete one you no longer use first`);
    const storageKey = `${randomUUID()}.${kind.ext}`;
    const dir = join(this.root(), workspaceId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, storageKey), file.buffer, { flag: "wx" });
    try {
      return await this.prisma.messageAttachment.create({
        data: { workspaceId, fileName: safeFileName(file.originalname, kind.ext), mimeType: kind.mime, sizeBytes: file.buffer.length, storageKey },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
    } catch (e) {
      await rm(join(dir, storageKey), { force: true });
      throw e;
    }
  }

  list(workspaceId: string) {
    return this.prisma.messageAttachment.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } });
  }

  /** The row for a file that belongs to this workspace; used to attach it to a message. */
  async owned(workspaceId: string, id: string) {
    const a = await this.prisma.messageAttachment.findFirst({ where: { id, workspaceId }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true } });
    if (!a) throw new NotFoundException("Attachment not found");
    return a;
  }

  /** A file that a waiting message still needs cannot be deleted: the message would go out without it. */
  async remove(workspaceId: string, id: string) {
    const a = await this.prisma.messageAttachment.findFirst({ where: { id, workspaceId } });
    if (!a) throw new NotFoundException("Attachment not found");
    const waiting = await this.prisma.outboundMessage.count({ where: { attachmentId: id, status: { in: IN_USE } } });
    if (waiting > 0) throw new BadRequestException(`${waiting} message(s) waiting in the Outbox still use this file. Remove it from them or send them first`);
    await this.prisma.messageAttachment.delete({ where: { id } }).catch(() => {
      throw new BadRequestException("This file was already sent in messages that are kept in the history, so it cannot be deleted");
    });
    await rm(join(this.root(), workspaceId, a.storageKey), { force: true });
    return { deleted: true };
  }

  /** The file's bytes for sending. Throws when the file is gone from disk, so the message fails instead of going out without it. */
  async load(workspaceId: string, id: string): Promise<{ data: Buffer; mimeType: string; fileName: string; kind: AttachmentKind }> {
    const a = await this.prisma.messageAttachment.findFirst({ where: { id, workspaceId } });
    if (!a) throw new Error("Attachment record is missing");
    const data = await readFile(join(this.root(), workspaceId, a.storageKey)).catch(() => {
      throw new Error("Attachment file is missing from the server");
    });
    const kind: AttachmentKind = a.mimeType.startsWith("image/") ? "image" : a.mimeType.startsWith("video/") ? "video" : "document";
    return { data, mimeType: a.mimeType, fileName: a.fileName, kind };
  }
}
