export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoCommit } = await import("@/lib/autoCommit");
    startAutoCommit();
  }
}
