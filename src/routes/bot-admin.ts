import { Router } from "express";
import { z } from "zod";
import { callLineWorksAdminApi } from "../integrations/lineworks-admin.client.js";
import { asyncHandler } from "../lib/async-handler.js";
import { config } from "../config.js";

const setupFixedMenuSchema = z.object({
  botId: z.string().min(1),
  endpointPathTemplate: z.string().min(1).optional(),
  method: z.union([z.literal("POST"), z.literal("PUT"), z.literal("PATCH")]).optional(),
  buttonLabel: z.string().min(1).default("日程調整を開始"),
  buttonUrl: z.string().url(),
  menuName: z.string().min(1).default("日程調整メニュー"),
  payload: z.record(z.unknown()).optional()
});

export const botAdminRouter = Router();

botAdminRouter.post(
  "/fixed-menu",
  asyncHandler(async (req, res) => {
    const parsed = setupFixedMenuSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid fixed-menu payload",
          details: parsed.error.flatten()
        }
      });
    }

    const input = parsed.data;
    const template = input.endpointPathTemplate ?? config.lineWorks.botFixedMenuPathTemplate;
    if (!template) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "endpointPathTemplate is required. Set in request or LW_BOT_FIXED_MENU_PATH_TEMPLATE.",
          details: {}
        }
      });
    }
    const path = template.replace("{botId}", encodeURIComponent(input.botId));
    const payload =
      input.payload ??
      ({
        name: input.menuName,
        buttons: [
          {
            type: "url",
            label: input.buttonLabel,
            url: input.buttonUrl
          }
        ]
      } as const);
    const method = input.method ?? "POST";

    const result = await callLineWorksAdminApi({
      method,
      path,
      payload
    });

    if (!result.ok) {
      return res.status(502).json({
        error: {
          code: "INTEGRATION_ERROR",
          message: `LINE WORKS fixed-menu setup failed: ${result.status}`,
          details: { path, method, response: result.data ?? result.text }
        }
      });
    }

    return res.json({
      ok: true,
      path,
      method,
      response: result.data ?? result.text
    });
  })
);
