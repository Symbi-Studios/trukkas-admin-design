import { chromium } from "playwright";

const baseUrl = process.env.RESPONSIVE_BASE_URL || "http://localhost:3000";
const routes = [
  "/dashboard", "/jobs", "/trips", "/bids", "/dispatch", "/tracking",
  "/companies", "/drivers", "/fleet", "/maintenance", "/forwarders",
  "/cargo", "/cargo-types", "/triangulation", "/documents", "/verification",
  "/wallets", "/payouts", "/settlements", "/transactions", "/fees", "/pricing",
  "/reports", "/users", "/roles", "/settings", "/notifications", "/audit",
  "/tickets", "/knowledge-base", "/feedback", "/demurrage", "/faq", "/announcements", "/calculator",
  "/jobs/JOB-29821", "/payouts/PAY-77423", "/companies/TC-DCL-001?tab=payouts",
  "/announcements/ANN-2024-0007", "/announcements/ANN-2024-0007/edit", "/announcements/new",
  "/demurrage/DEM-2026-000058", "/documents/d1", "/drivers/DR-000245",
  "/escrow/HOLD-87291", "/feedback/FBK-000128", "/fees/FR-2024-0001",
  "/fleet/KJA-123-XD", "/forwarders/FWD-000128",
  "/knowledge-base/how-to-create-a-new-trip", "/knowledge-base/how-to-create-a-new-trip/edit", "/knowledge-base/new",
  "/maintenance/MTN-2026-00156", "/notifications/NTF-2026-000567",
  "/pricing/SVC-2026-0001", "/reports/export", "/reports/export/preview", "/roles/new",
  "/settings/data-protection", "/settings/finance", "/settings/fleet", "/settings/integrations",
  "/settings/notifications", "/settings/operations", "/settings/passwords", "/settings/security", "/settings/security-alerts",
  "/settlements/SETT-98231", "/tickets/TKTS-2024-0248", "/transactions/TRX-82931",
  "/triangulation/TRI-2026-0091", "/users/USR-2024-00078", "/verification/VER-2024-00567",
];
const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const failures = [];
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  for (const route of routes) {
    const errors = [];
    page.removeAllListeners("pageerror");
    page.on("pageerror", (error) => errors.push(error.message));
    let response;
    try {
      response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (error) {
      failures.push({ viewport: viewport.name, route, errors: [`Navigation failed: ${error.message}`] });
      continue;
    }
    await page.waitForTimeout(200);
    const audit = await page.evaluate(() => {
      const shell = document.querySelector(".tk-app-scroll");
      const offenders = [...document.querySelectorAll(".tk-page-main *")].filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.position === "fixed" || style.position === "absolute") return false;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.top > innerHeight * 2) return false;
        const positionedParent = element.parentElement?.closest("[style]");
        if (positionedParent && ["absolute", "fixed"].includes(getComputedStyle(positionedParent).position)) return false;
        const scrollParent = element.closest(".tk-scroll");
        if (scrollParent && scrollParent !== shell) return false;
        return rect.left < -2 || rect.right > innerWidth + 2;
      }).slice(0, 5).map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
        width: Math.round(element.getBoundingClientRect().width),
      }));
      return {
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        shellOverflow: shell ? shell.scrollWidth - shell.clientWidth : 0,
        offenders,
      };
    });
    if (!response?.ok() || errors.length || audit.documentOverflow > 4 || audit.shellOverflow > 4 || (audit.shellOverflow > 4 && audit.offenders.length)) {
      failures.push({ viewport: viewport.name, route, status: response?.status(), errors, ...audit });
    }
  }
  await page.close();
}

const mobilePage = await browser.newPage({ viewport: viewports[0] });
await mobilePage.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15_000 });
await mobilePage.locator(".tk-topbar-menu").click();
await mobilePage.waitForTimeout(400);
const drawerOpened = await mobilePage.evaluate(() => {
  const sidebar = document.querySelector(".tk-sidebar-slot")?.getBoundingClientRect();
  return Boolean(sidebar && sidebar.left >= -1 && document.querySelector(".tk-sidebar-scrim"));
});
if (!drawerOpened) failures.push({ viewport: "phone", route: "/dashboard", errors: ["Mobile navigation drawer did not open."] });
await mobilePage.mouse.click(viewports[0].width - 8, Math.round(viewports[0].height / 2));
await mobilePage.waitForTimeout(400);
const drawerClosed = await mobilePage.evaluate(() => document.querySelector(".tk-sidebar-slot")?.getBoundingClientRect().right <= 1);
if (!drawerClosed) failures.push({ viewport: "phone", route: "/dashboard", errors: ["Mobile navigation drawer did not close."] });
await mobilePage.close();
await browser.close();

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log(`Responsive audit passed for ${routes.length} routes across ${viewports.length} viewport sizes.`);
