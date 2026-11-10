import type { Order } from "@prisma/client";
import { prisma } from "../infra/db.js";
import { calcAmountKop } from "./pricing.js";
import type { PaymentMethod } from "./statuses.js";

export type OrderFileInput = {
  fileId: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  pages: number;
  pagesExact: boolean;
  sha256: string;
};

export type CreateOrderInput = {
  clientId: bigint;
  files: readonly OrderFileInput[];
  copies: number;
  comment?: string | undefined;
  location: string;
  phone: string | null;
  paymentMethod: PaymentMethod;
  pricePerPageKop: number;
};

/** 7n -> "PB-0007" */
export function formatOrderCode(value: bigint | number): string {
  const asBigInt = typeof value === "bigint" ? value : BigInt(Math.trunc(value));
  if (asBigInt <= 0n) {
    throw new RangeError("Номер замовлення має бути додатним");
  }
  return `PB-${asBigInt.toString().padStart(4, "0")}`;
}

export async function nextOrderCode(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('order_code_seq') AS nextval
  `;
  const value = rows[0]?.nextval;
  if (!value) {
    throw new Error("Не вдалося отримати номер замовлення");
  }
  return formatOrderCode(value);
}

export function totalPages(files: readonly { pages: number }[]): number {
  return files.reduce((sum, file) => sum + file.pages, 0);
}

export function orderAmountKop(
  files: readonly { pages: number }[],
  copies: number,
  pricePerPageKop: number,
): number {
  return calcAmountKop(totalPages(files), copies, pricePerPageKop);
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const pagesTotal = totalPages(input.files);
  const amountKop = calcAmountKop(pagesTotal, input.copies, input.pricePerPageKop);
  const code = await nextOrderCode();
  const paymentStatus = input.paymentMethod === "cash" ? "unpaid" : "pending_review";

  return prisma.$transaction(async (tx) => {
    return tx.order.create({
      data: {
        code,
        clientId: input.clientId,
        status: "QUEUED",
        paymentMethod: input.paymentMethod,
        paymentStatus,
        pagesTotal,
        pagesExact: input.files.every((file) => file.pagesExact),
        copies: input.copies,
        amountKop,
        comment: input.comment ?? null,
        locationSnapshot: input.location,
        phoneSnapshot: input.phone,
        files: {
          create: input.files.map((file) => ({
            telegramFileId: file.fileId,
            fileName: file.fileName,
            mime: file.mime,
            sizeBytes: file.sizeBytes,
            pages: file.pages,
            pagesExact: file.pagesExact,
            sha256: file.sha256,
          })),
        },
        events: {
          create: {
            actorId: input.clientId,
            type: "order_created",
            toValue: "QUEUED",
            payload: {
              files: input.files.length,
              pages: pagesTotal,
              copies: input.copies,
              amountKop,
            },
          },
        },
        ...(input.paymentMethod === "cash"
          ? {}
          : {
              payments: {
                create: {
                  provider: "manual",
                  status: "pending_review",
                  amountKop,
                },
              },
            }),
      },
    });
  });
}

export async function countOrdersLastHour(
  clientId: bigint,
  now: Date = new Date(),
): Promise<number> {
  return prisma.order.count({
    where: {
      clientId,
      createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });
}
