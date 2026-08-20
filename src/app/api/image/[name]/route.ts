import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const IMAGE_DIR = path.join(process.cwd(), "data", "images");
// Thư mục cũ: bản đầu lưu ở public/uploads, vẫn đọc được để không mất ảnh cũ.
const LEGACY_DIR = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Phục vụ ảnh xe qua API thay vì để trong public/ — Next chỉ quét public/ lúc
 * khởi động nên ảnh tải lên sau đó sẽ 404 cho tới khi restart server.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Chỉ nhận đúng tên file, chặn kiểu ../../ đi ra ngoài thư mục ảnh.
  if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  const file = [path.join(IMAGE_DIR, name), path.join(LEGACY_DIR, name)].find((p) => fs.existsSync(p));
  if (!file) return new Response("Not found", { status: 404 });

  const body = fs.readFileSync(file);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      // Tên file có timestamp + chuỗi ngẫu nhiên nên không bao giờ đổi nội dung.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
