export type Draft = {
  fullName?: string;
  phone?: string;
  location?: string;
};

export type OrderFileDraft = {
  fileId: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  pages: number;
  pagesExact: boolean;
  sha256: string;
};

export type OrderDraft = {
  files: OrderFileDraft[];
  copies: number;
  comment?: string;
};

export type Step =
  | "reg_name"
  | "reg_phone"
  | "reg_location"
  | "reg_confirm"
  | "edit_name"
  | "edit_phone"
  | "edit_location"
  | "admin_add_worker"
  | "order_files"
  | "order_copies"
  | "order_copies_custom"
  | "order_confirm"
  | "order_comment"
  | "staff_price"
  | "staff_announce"
  | "staff_block";

export type StaffAction = {
  orderId: string;
};

export type ConversationState = {
  step: Step;
  draft: Draft;
  order?: OrderDraft;
  staffAction?: StaffAction;
};

const TTL_MS = 30 * 60 * 1000;

const states = new Map<string, { state: ConversationState; updatedAt: number }>();

export function getState(key: string): ConversationState | undefined {
  const entry = states.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.updatedAt > TTL_MS) {
    states.delete(key);
    return undefined;
  }
  return entry.state;
}

export function setState(key: string, state: ConversationState): void {
  states.set(key, { state, updatedAt: Date.now() });
}

export function clearState(key: string): void {
  states.delete(key);
}

export function isRegistrationStep(step: Step): boolean {
  return step.startsWith("reg_");
}

export function isOrderStep(step: Step): boolean {
  return step.startsWith("order_");
}
