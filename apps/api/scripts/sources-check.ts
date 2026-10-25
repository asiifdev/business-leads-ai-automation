/**
 * Checks lead sources and file import end to end against a RUNNING API (queue, worker, database) in a throwaway workspace.
 * Start the API first with a scratch database and its own Redis database, then run:
 *   API_URL=http://localhost:3999/api DATABASE_URL=... npx tsx scripts/sources-check.ts
 * Set SKIP_OSM=true to skip the part that calls the public Nominatim and Overpass services (it can take a minute or more).
 * No AI provider is needed; without one, leads are scored from the listing alone.
 */
import { PrismaService } from "../src/prisma/prisma.service";

const API = process.env.API_URL ?? "http://localhost:3001/api";
const prisma = new PrismaService();
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
const skip = (name: string, why: string) => console.log(`SKIP  ${name}  ${why}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let token = "";

async function call<T = unknown>(method: string, path: string, body?: unknown, form?: FormData): Promise<{ status: number; body: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: res.status, body: parsed as T };
}

interface CampaignView { id: string; status: string; error: string | null; totalLeads: number; sources: string[] }

async function finished(id: string, ms: number): Promise<CampaignView> {
  const end = Date.now() + ms;
  for (;;) {
    const c = (await call<CampaignView>("GET", `/campaigns/${id}`)).body;
    if ((c.status === "completed" || c.status === "failed") && !(await prisma.lead.count({ where: { campaignId: id } }).then((n) => n === 0 && c.status === "completed"))) return c;
    if (Date.now() > end) return c;
    await sleep(1500);
  }
}

const csvForm = (text: string, mapping?: unknown) => {
  const f = new FormData();
  f.append("file", new Blob([text], { type: "text/csv" }), "contoh.csv");
  if (mapping) f.append("mapping", JSON.stringify(mapping));
  return f;
};

async function main() {
  await prisma.$connect();
  const stamp = Date.now().toString(36);
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Sources Check", email: `sources-${stamp}@example.com`, password: "check-password-1", workspaceName: `sources-check ${stamp}` }),
  });
  const session = (await reg.json()) as { token: string; workspace?: { id: string }; user?: { id: string } };
  token = session.token;
  const me = (await call<{ workspaceId?: string; workspace?: { id: string } }>("GET", "/auth/me")).body;
  const ws = me.workspaceId ?? me.workspace?.id ?? (await prisma.workspace.findFirstOrThrow({ where: { slug: { contains: stamp } } })).id;
  try {
    const mk = async (over: Record<string, unknown>) => (await call<CampaignView>("POST", "/campaigns", { name: "c", industry: "restoran", location: "Bandung", searchQueries: ["restoran"], yourService: "jasa foto produk", maxResults: 5, ...over })).body;

    // 1. sources are validated and stored
    const bad = await call("POST", "/campaigns", { name: "c", industry: "x", location: "x", searchQueries: ["x"], yourService: "x", sources: ["facebook"] });
    check("an unknown source is refused", bad.status === 400);
    const dflt = await mk({});
    check("a campaign without sources uses Google Maps", dflt.sources?.join() === "google_maps", String(dflt.sources));

    // 2. OpenStreetMap through the queue and worker (public services)
    let osmLeads: { id: string; phone: string | null; name: string; source: string; fieldMeta: unknown }[] = [];
    const osm = await mk({ sources: ["osm"] });
    check("a campaign can use OpenStreetMap only", osm.sources?.join() === "osm");
    if (process.env.SKIP_OSM === "true") skip("OpenStreetMap run", "SKIP_OSM=true");
    else {
      const started = await call("POST", `/scraper/campaigns/${osm.id}/start`);
      check("the OpenStreetMap campaign is queued", started.status === 202, String(started.status));
      const done = await finished(osm.id, 240_000);
      const external = done.status === "failed" && /OpenStreetMap: .*(busy|timed out|answered|rate-limited|not JSON)/i.test(done.error ?? "");
      if (external) skip("OpenStreetMap run", `public service unavailable: ${done.error}`);
      else {
        check("the OpenStreetMap run completes", done.status === "completed", `${done.status} ${done.error ?? ""}`);
        osmLeads = await prisma.lead.findMany({ where: { campaignId: osm.id }, select: { id: true, phone: true, name: true, source: true, fieldMeta: true } });
        check("it saved leads, all marked as OpenStreetMap", osmLeads.length > 0 && osmLeads.every((l) => l.source === "osm"), `${osmLeads.length} leads`);
        check("every one has a way to be contacted", (await prisma.lead.count({ where: { campaignId: osm.id, phone: null, email: null, website: null } })) === 0);
        const meta = osmLeads[0]?.fieldMeta as Record<string, { source: string }> | null;
        check("each field records OpenStreetMap as its source", meta?.name?.source === "osm");
        check("the campaign's totals match the leads", done.totalLeads === osmLeads.length, `${done.totalLeads} vs ${osmLeads.length}`);
      }
    }

    // 2b. Overture Maps through the queue, worker and DuckDB (slow: the first search reads the files' index, several minutes)
    if (process.env.RUN_OVERTURE !== "true") skip("Overture Maps run", "set RUN_OVERTURE=true (it takes several minutes)");
    else {
      const ov = await mk({ sources: ["overture"], maxResults: 5 });
      check("a campaign can use Overture Maps only", ov.sources?.join() === "overture");
      await call("POST", `/scraper/campaigns/${ov.id}/start`);
      const done = await finished(ov.id, 20 * 60_000);
      const external = done.status === "failed" && /Overture Maps: .*(rate-limited|answered|S3|catalogue|DuckDB package)/i.test(done.error ?? "");
      if (external) skip("Overture Maps run", `service unavailable: ${done.error}`);
      else {
        const got = await prisma.lead.findMany({ where: { campaignId: ov.id } });
        check("the Overture Maps run completes with the number of leads asked for", done.status === "completed" && got.length === 5, `${done.status} ${done.error ?? ""} ${got.length} leads`);
        check("branches of a chain that share a website are separate leads", new Set(got.map((l) => l.phone)).size === got.length && got.filter((l) => l.duplicateOfId).length === 0);
        check("they are marked as Overture, with a way to reach them", got.every((l) => l.source === "overture" && (l.phone || l.email || l.website || (l.enrichment as { social?: unknown } | null)?.social)));
        check("a Facebook page listed by the source is kept for reading", got.some((l) => (l.enrichment as { social?: { facebook?: string } } | null)?.social?.facebook) || got.every((l) => !!l.phone));
      }
    }

    // 3. a file import: preview, then import, into a campaign
    const target = await mk({ sources: ["google_maps"] });
    const reuse = osmLeads.find((l) => l.phone);
    const csv = [
      "Nama Usaha;No HP;Email;Website;Alamat;Kota",
      "Contoh Kopi Satu;0812-0000-1001;halo@kopi-satu.example.com;kopi-satu.example.com;Jl. Mawar 1;Bandung",
      "Contoh Kopi Dua;0812-0000-1002;;;Jl. Melati 2;Bandung",
      ";0812-0000-1003;;;;",
      "Salah Isi;bukan nomor;bukan email;;;",
      ...(reuse ? [`Salinan Dari OSM;${reuse.phone};;;;`] : []),
    ].join("\r\n");
    const prev = await call<{ format: string; columns: string[]; mapping: Record<string, number | null>; rows: number; report: { leads: number; noName: number; badPhone: number; badEmail: number } }>("POST", `/scraper/campaigns/${target.id}/import/preview`, undefined, csvForm(csv));
    check("the preview reads a semicolon CSV and finds the columns", prev.status === 201 && prev.body.format === "csv" && prev.body.mapping.name === 0 && prev.body.mapping.phone === 1 && prev.body.mapping.email === 2, JSON.stringify(prev.body.mapping));
    check("the preview says what would happen", prev.body.report?.noName === 1 && prev.body.report?.badPhone === 1 && prev.body.report?.badEmail === 1, JSON.stringify(prev.body.report));
    check("a file that is not a spreadsheet is refused", (await call("POST", `/scraper/campaigns/${target.id}/import/preview`, undefined, (() => { const f = new FormData(); f.append("file", new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 1, 2])]), "x.pdf"); return f; })())).status === 400);
    check("a column outside the file is refused", (await call("POST", `/scraper/campaigns/${target.id}/import`, undefined, csvForm(csv, { name: 40 }))).status === 400);
    const imp = await call("POST", `/scraper/campaigns/${target.id}/import`, undefined, csvForm(csv));
    check("the import is accepted", imp.status === 202, String(imp.status));
    const imported = await finished(target.id, 60_000);
    check("the import completes with a note", imported.status === "completed" && /Imported \d+ rows from contoh\.csv/.test(imported.error ?? ""), `${imported.status} ${imported.error ?? ""}`);
    const rows = await prisma.lead.findMany({ where: { campaignId: target.id } });
    const byName = (n: string) => rows.find((r) => r.name === n);
    check("rows with a name became leads from the file", byName("Contoh Kopi Satu")?.source === "csv_import" && byName("Contoh Kopi Satu")?.email === "halo@kopi-satu.example.com", `${rows.length} leads`);
    check("a row without a name was skipped", !rows.some((r) => r.phone?.includes("1003")));
    check("a bad phone and a bad email were dropped, not stored", !!byName("Salah Isi") && !byName("Salah Isi")?.phone && !byName("Salah Isi")?.email);
    check("the file's fields are marked as coming from the file", (byName("Contoh Kopi Dua")?.fieldMeta as Record<string, { source: string }> | null)?.phone?.source === "csv_import");
    if (reuse) {
      const copy = byName("Salinan Dari OSM");
      check("a row repeating a lead found by OpenStreetMap is marked as a repeat", copy?.duplicateOfId === reuse.id && copy?.dataQuality === "low", `${copy?.duplicateOfId} vs ${reuse.id}`);
    } else skip("repeat across sources", "no OpenStreetMap lead with a phone to repeat");
    check("the campaign's totals count the file's leads", imported.totalLeads === rows.length, `${imported.totalLeads} vs ${rows.length}`);

    // 4. a second import adds to the campaign instead of replacing it
    const again = await call("POST", `/scraper/campaigns/${target.id}/import`, undefined, csvForm("Nama,Telepon\nTambahan Satu,0812-0000-1999"));
    check("a second import is accepted", again.status === 202);
    const after = await finished(target.id, 60_000);
    const total = await prisma.lead.count({ where: { campaignId: target.id } });
    check("it adds to the leads already there", total === rows.length + 1 && after.totalLeads === total, `${total} leads, totals say ${after.totalLeads}`);

    // 4b. a pasted list of websites (reads real pages, so it needs the network)
    if (process.env.SKIP_OSM === "true") skip("website list", "SKIP_OSM=true");
    else {
      const sites = await mk({ sources: ["google_maps"] });
      const none = await call("POST", `/scraper/campaigns/${sites.id}/import/websites`, { text: "  " });
      check("an empty list is refused", none.status === 400);
      const list = await call<{ accepted: number; duplicates: number; unsupported: number; invalid: string[] }>("POST", `/scraper/campaigns/${sites.id}/import/websites`, { text: "example.com, https://www.example.com/about, linktr.ee/contoh, tidak-ada-prospex-check.invalid, bukan alamat" });
      check("the list is accepted and its parts are counted", list.status === 202 && list.body.accepted === 2 && list.body.duplicates === 1 && list.body.unsupported === 1 && list.body.invalid.length === 2, JSON.stringify(list.body));
      const read = await finished(sites.id, 120_000);
      const got = await prisma.lead.findMany({ where: { campaignId: sites.id } });
      check("the page that opens becomes a lead, named from the page", got.length === 1 && got[0].source === "website_list" && /example/i.test(got[0].name) && got[0].website?.includes("example.com") === true, got.map((l) => l.name).join(", "));
      check("the one that cannot be opened is named in the note, not invented", read.status === "completed" && /Read 1 of 2 websites/.test(read.error ?? "") && /tidak-ada-prospex-check\.invalid/.test(read.error ?? ""), read.error ?? "");
    }

    // 5. a campaign that is running cannot be imported into
    await prisma.campaign.update({ where: { id: target.id }, data: { status: "running" } });
    check("importing into a running campaign is refused", (await call("POST", `/scraper/campaigns/${target.id}/import`, undefined, csvForm(csv))).status === 409);
    await prisma.campaign.update({ where: { id: target.id }, data: { status: "completed" } });

    // 6. another workspace's campaign cannot be imported into
    const other = await fetch(`${API}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Other", email: `other-${stamp}@example.com`, password: "check-password-1", workspaceName: `sources-other ${stamp}` }) });
    const otherToken = ((await other.json()) as { token: string }).token;
    const mine = token;
    token = otherToken;
    check("another workspace cannot import into this campaign", (await call("POST", `/scraper/campaigns/${target.id}/import`, undefined, csvForm(csv))).status === 404);
    token = mine;
    await prisma.workspace.deleteMany({ where: { slug: { contains: `sources-other-${stamp}` } } });
  } finally {
    await prisma.workspace.delete({ where: { id: ws } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: [`sources-${stamp}@example.com`, `other-${stamp}@example.com`] } } });
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
