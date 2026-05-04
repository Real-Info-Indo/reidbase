import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AppraisalRequest from "./AppraisalRequest";

// ---- Mocks ----
const uploadMock = vi.fn();
const removeMock = vi.fn();
const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: any[]) => uploadMock(...args),
        remove: (...args: any[]) => removeMock(...args),
      }),
    },
    functions: {
      invoke: (...args: any[]) => invokeMock(...args),
    },
  },
}));

vi.mock("@/contexts/TierContext", () => ({
  useTier: () => ({
    tier: "reid_base_pro",
    canAccess: () => true,
    userName: "Test",
    setTier: () => {},
    refreshTier: async () => {},
    isRefreshing: false,
  }),
}));

vi.mock("@/components/UpgradeOverlay", () => ({
  UpgradeOverlay: () => null,
}));

vi.mock("@/lib/analytics", () => ({
  trackFeature: vi.fn(),
}));

vi.mock("@/lib/wixToken", () => ({
  wixAuthHeader: async () => ({ Authorization: "Bearer test" }),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

// crypto.randomUUID polyfill for jsdom
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
  // @ts-ignore
  globalThis.crypto.randomUUID = () => "test-request-id-1234";
}

function fillRequiredFields() {
  fireEvent.change(screen.getByDisplayValue("Select type"), { target: { value: "Villa" } });
  fireEvent.change(screen.getByPlaceholderText("Search location..."), { target: { value: "Canggu" } });
  // Two "Select" selects for ownership and land zone — find by their label
  const ownershipSelect = screen.getByText("Ownership Type").parentElement!.querySelector("select")!;
  fireEvent.change(ownershipSelect, { target: { value: "Freehold" } });
  const landZoneSelect = screen.getByText("Land Zone").parentElement!.querySelector("select")!;
  fireEvent.change(landZoneSelect, { target: { value: "Residential (Yellow)" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. 25"), { target: { value: "25" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. 500"), { target: { value: "500" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. 300"), { target: { value: "300" } });
  const propStatusSelect = screen.getByText("Property Status").parentElement!.querySelector("select")!;
  fireEvent.change(propStatusSelect, { target: { value: "completed" } });
  const bedroomsInput = screen.getByText("Bedrooms").parentElement!.querySelector("input")!;
  fireEvent.change(bedroomsInput, { target: { value: "3" } });
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
  return file;
}

function getFileInput(): HTMLInputElement {
  // The hidden input inside the upload panel
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function attachFiles(files: File[]) {
  const input = getFileInput();
  Object.defineProperty(input, "files", {
    value: files,
    configurable: true,
  });
  fireEvent.change(input);
}

describe("AppraisalRequest", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    removeMock.mockReset();
    invokeMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("happy path: paid user fills form, attaches PDF + JPG, submits, sees confirmation, resets", async () => {
    uploadMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    render(<AppraisalRequest />);
    fillRequiredFields();

    const pdf = makeFile("plan.pdf", "application/pdf", 1024);
    const jpg = makeFile("photo.jpg", "image/jpeg", 2048);
    attachFiles([pdf, jpg]);

    // Selected files visible before submit
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    // Uploads went to appraisal-requests/{requestId}/...
    expect(uploadMock).toHaveBeenCalledTimes(2);
    const firstPath = uploadMock.mock.calls[0][0];
    expect(firstPath).toMatch(/^appraisal-requests\/test-request-id-1234\/\d+_plan\.pdf$/);
    const secondPath = uploadMock.mock.calls[1][0];
    expect(secondPath).toMatch(/^appraisal-requests\/test-request-id-1234\/\d+_photo\.jpg$/);

    // send-appraisal payload includes requestId and file metadata
    const [fnName, opts] = invokeMock.mock.calls[0];
    expect(fnName).toBe("send-appraisal");
    expect(opts.body.requestId).toBe("test-request-id-1234");
    expect(opts.body.files).toHaveLength(2);
    expect(opts.body.files[0]).toMatchObject({ name: "plan.pdf", mimeType: "application/pdf", size: 1024 });
    expect(opts.body.files[1]).toMatchObject({ name: "photo.jpg", mimeType: "image/jpeg", size: 2048 });

    // Confirmation dialog appears
    await waitFor(() => expect(screen.getByText("Request Submitted")).toBeInTheDocument());

    // Form resets
    expect(screen.getByPlaceholderText("Search location...")).toHaveValue("");
    expect(screen.queryByText("plan.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("photo.jpg")).not.toBeInTheDocument();
  });

  it("rejects unsupported file type with toast", () => {
    render(<AppraisalRequest />);
    const bad = makeFile("malware.exe", "application/x-msdownload", 1024);
    attachFiles([bad]);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Unsupported file type",
      expect.objectContaining({ description: expect.stringContaining("malware.exe") }),
    );
    expect(screen.queryByText("malware.exe")).not.toBeInTheDocument();
  });

  it("rejects file > 10MB with toast", () => {
    render(<AppraisalRequest />);
    const big = makeFile("huge.pdf", "application/pdf", 11 * 1024 * 1024);
    attachFiles([big]);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "File too large",
      expect.objectContaining({ description: expect.stringContaining("huge.pdf") }),
    );
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();
  });

  it("cleans up uploaded files when send-appraisal fails", async () => {
    uploadMock.mockResolvedValue({ error: null });
    invokeMock.mockResolvedValue({ data: null, error: { message: "boom", context: { status: 500 } } });
    removeMock.mockResolvedValue({ error: null });

    render(<AppraisalRequest />);
    fillRequiredFields();
    attachFiles([makeFile("plan.pdf", "application/pdf", 1024)]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    await waitFor(() => expect(removeMock).toHaveBeenCalled());
    const removedPaths = removeMock.mock.calls[0][0];
    expect(removedPaths).toHaveLength(1);
    expect(removedPaths[0]).toMatch(/^appraisal-requests\/test-request-id-1234\//);
    expect(screen.queryByText("Request Submitted")).not.toBeInTheDocument();
  });
});
