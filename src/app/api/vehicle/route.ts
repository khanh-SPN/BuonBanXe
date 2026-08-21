import { NextResponse } from "next/server";
import {
  attachImage,
  cancelDeposit,
  deleteImage,
  deleteVehicle,
  depositVehicle,
  editVehicle,
  importVehicle,
  sellVehicle,
  unsellVehicle,
  type ActionResult,
} from "@/lib/inventory";
import { amount, id, text } from "@/lib/parse";

export const runtime = "nodejs";

function bad(message: string): ActionResult {
  return { ok: false, message };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json(bad("Dữ liệu gửi lên không hợp lệ."), { status: 400 });

  const action = String(body.action ?? "");
  const vehicleId = id(body.id);
  const at = text(body.at) ?? undefined;

  let result: ActionResult;

  switch (action) {
    case "import": {
      const price = amount(body.price);
      if (price == null) return NextResponse.json(bad(`Giá nhập không đọc được: "${body.price}"`));
      result = importVehicle({
        name: String(body.name ?? ""),
        price,
        at,
        note: text(body.note),
        images: Array.isArray(body.images) ? body.images.filter((p: unknown) => typeof p === "string") : [],
      });
      break;
    }
    case "deposit": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      const deposit = amount(body.deposit);
      const agreedPrice = amount(body.agreedPrice);
      if (deposit == null) return NextResponse.json(bad(`Tiền cọc không đọc được: "${body.deposit}"`));
      if (agreedPrice == null) return NextResponse.json(bad(`Giá bán ra không đọc được: "${body.agreedPrice}"`));
      result = depositVehicle({
        id: vehicleId,
        deposit,
        agreedPrice,
        customerName: String(body.customerName ?? ""),
        note: text(body.note),
        at,
      });
      break;
    }
    case "cancel_deposit": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      result = cancelDeposit({ id: vehicleId, refund: amount(body.refund) ?? 0, note: text(body.note) });
      break;
    }
    case "sell": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      const price = amount(body.price);
      if (price == null) return NextResponse.json(bad(`Giá treo không đọc được: "${body.price}"`));
      // Bỏ trống trả trước là hợp lệ — chỉ báo lỗi khi gõ vào mà đọc không ra.
      const blankUpfront = body.upfront === undefined || body.upfront === null || body.upfront === "";
      const upfront = blankUpfront ? 0 : amount(body.upfront);
      if (upfront == null) return NextResponse.json(bad(`Tiền trả trước không đọc được: "${body.upfront}"`));
      result = sellVehicle({
        id: vehicleId,
        price,
        upfront,
        customerName: text(body.customerName),
        note: text(body.note),
        at,
      });
      break;
    }
    case "unsell": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      result = unsellVehicle(vehicleId);
      break;
    }
    case "edit": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      const price = body.price === undefined || body.price === "" ? undefined : amount(body.price);
      if (price === null) return NextResponse.json(bad(`Giá nhập không đọc được: "${body.price}"`));
      result = editVehicle({
        id: vehicleId,
        name: body.name === undefined ? undefined : String(body.name),
        price,
        note: body.note === undefined ? undefined : text(body.note),
      });
      break;
    }
    case "delete": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      result = deleteVehicle(vehicleId);
      break;
    }
    case "add_image": {
      if (!vehicleId) return NextResponse.json(bad("Chưa chọn xe."));
      const path = text(body.path);
      if (!path) return NextResponse.json(bad("Thiếu đường dẫn ảnh."));
      const img = attachImage(vehicleId, path);
      result = img
        ? { ok: true, vehicleId, message: "Đã thêm ảnh." }
        : bad(`Không tìm thấy xe #${vehicleId}.`);
      break;
    }
    case "delete_image": {
      const imageId = id(body.imageId);
      if (!imageId) return NextResponse.json(bad("Thiếu ảnh cần xoá."));
      result = deleteImage(imageId);
      break;
    }
    default:
      result = bad(`Thao tác không hợp lệ: ${action}`);
  }

  return NextResponse.json(result);
}
