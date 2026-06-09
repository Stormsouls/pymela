import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getConnectionByMlUserId, getFreshToken, mlFetch } from "@/lib/ml-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const mlUid = req.cookies.get("pymela_ml_uid")?.value;
  if (!mlUid) return NextResponse.json({ error: "No identificado" }, { status: 401 });

  const conn = await getConnectionByMlUserId(mlUid);
  if (!conn) return NextResponse.json({ error: "Sin conexión" }, { status: 404 });

  const token = await getFreshToken(conn);

  // 1. Obtener IDs de publicaciones activas (hasta 100)
  const page1 = await mlFetch(`/users/${mlUid}/items/search?status=active&limit=50&offset=0`, token);
  const ids: string[] = [...(page1.results ?? [])];
  if ((page1.paging?.total ?? 0) > 50) {
    try {
      const page2 = await mlFetch(`/users/${mlUid}/items/search?status=active&limit=50&offset=50`, token);
      ids.push(...(page2.results ?? []));
    } catch { /* continuar con page1 */ }
  }

  if (ids.length === 0) return NextResponse.json([]);

  // 2. Multi-get detalles en batches de 20
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) batches.push(ids.slice(i, i + 20));

  const itemDetails: Record<string, { title: string; thumbnail: string; price: number }> = {};
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const raw = await mlFetch(
          `/items?ids=${batch.join(",")}&attributes=id,title,thumbnail,price`,
          token
        );
        for (const entry of raw) {
          if (entry.code === 200 && entry.body?.id) {
            itemDetails[entry.body.id] = {
              title: entry.body.title ?? entry.body.id,
              thumbnail: entry.body.thumbnail ?? "",
              price: entry.body.price ?? 0,
            };
          }
        }
      } catch { /* ignorar batch fallido */ }
    })
  );

  // 3. Traer settings guardados de Supabase
  const db = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (db.from("ml_item_settings") as any)
    .select("item_id, active, custom_playbook")
    .eq("ml_user_id", mlUid);

  const settingsMap: Record<string, { active: boolean; custom_playbook: string | null }> = {};
  for (const s of settings ?? []) settingsMap[s.item_id] = s;

  // 4. Combinar y devolver
  const result = ids
    .filter((id) => itemDetails[id])
    .map((id) => ({
      id,
      title: itemDetails[id].title,
      thumbnail: itemDetails[id].thumbnail,
      price: itemDetails[id].price,
      active: settingsMap[id]?.active ?? true,
      custom_playbook: settingsMap[id]?.custom_playbook ?? "",
    }));

  return NextResponse.json(result);
}
