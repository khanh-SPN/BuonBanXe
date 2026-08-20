import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";

export const dynamic = "force-dynamic";

export default function Home() {
  // Tải sẵn dữ liệu ở server để mở trang là có số ngay, không chớp màn hình chờ.
  return <AppShell initialState={getState()} />;
}
