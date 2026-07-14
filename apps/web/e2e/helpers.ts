import { expect, type Page, type BrowserContext } from "@playwright/test";

// A unique-ish suffix per test run so reruns against the same Postgres don't
// collide on the unique email index. Playwright forbids Date.now()/random in
// workflow scripts, not in test files, so this is fine here.
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export function makeUser(label: string): TestUser {
  const suffix = uniqueSuffix();
  return {
    email: `e2e-${label}-${suffix}@example.com`,
    password: "correct horse battery staple",
    name: `E2E ${label} ${suffix}`,
  };
}

// Registers a user through the real POST /api/auth/register endpoint, using
// the page's request context (no session needed for registration).
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post("/api/auth/register", {
    data: { email: user.email, password: user.password, name: user.name },
  });
  expect(response.ok(), `register ${user.email}: ${response.status()}`).toBeTruthy();
}

// Signs in through the real login form and waits for the documents page —
// this exercises NextAuth's credentials flow and sets the session cookie on
// the browser context.
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/documents");
}

export async function registerAndLogin(page: Page, user: TestUser): Promise<void> {
  await registerUser(page, user);
  await login(page, user);
}

// Creates a document via the "New document" button and returns its id from the
// resulting /documents/:id URL.
export async function createDocument(page: Page): Promise<string> {
  await page.goto("/documents");
  await page.getByRole("button", { name: /new document/i }).click();
  await page.waitForURL(/\/documents\/[0-9a-f-]+$/);
  const match = /\/documents\/([0-9a-f-]+)$/.exec(page.url());
  if (!match) throw new Error(`could not parse document id from ${page.url()}`);
  return match[1];
}

// Adds another registered user to a document as editor/viewer, via the
// authenticated members API (there is no share UI). Must be called on a page
// whose session owns the document.
export async function addMember(
  page: Page,
  documentId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<void> {
  const response = await page.request.post(`/api/documents/${documentId}/members`, {
    data: { email, role },
  });
  expect(response.ok(), `add member ${email} as ${role}: ${response.status()}`).toBeTruthy();
}

// The ProseMirror editor surface. Tiptap renders a contenteditable div with
// class "ProseMirror"; typing into it drives the same Yjs updates a user
// would produce.
export function editorLocator(page: Page) {
  return page.locator(".ProseMirror");
}

export async function typeInEditor(page: Page, text: string): Promise<void> {
  const editor = editorLocator(page);
  await editor.click();
  await editor.pressSequentially(text);
}

// Opens a second independent browser context (a distinct session/tab) so two
// users — or the same user in two tabs — can edit concurrently.
export async function newSession(context: BrowserContext): Promise<Page> {
  return context.newPage();
}
