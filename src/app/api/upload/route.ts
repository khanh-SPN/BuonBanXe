import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Nhận ảnh dán từ clipboard (Win+Shift+S) dưới dạng dataURL, ghi ra public/uploads. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";

  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ ok: false, message: "Ảnh không hợp lệ." }, { status: 400 });

  const ext = EXT[match[1]];
  if (!ext) return NextResponse.json({ ok: false, message: `Định dạng ${match[1]} không hỗ trợ.` }, { status: 400 });

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "Ảnh quá nặng (tối đa 8MB)." }, { status: 400 });
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);

  return NextResponse.json({ ok: true, path: `/uploads/${name}`, message: "Đã tải ảnh lên." });
}
