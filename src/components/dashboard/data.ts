import "server-only";
import { cache } from "react";
import { getMyPlan } from "@/lib/billing/server";

/**
 * get_my_plan, deduplicated per render, so the sidebar plan box and the page share one call.
 * Only for Server Components: billing API routes call getMyPlan() directly so they always read fresh state.
 */
export const getPlanForRender = cache(getMyPlan);
