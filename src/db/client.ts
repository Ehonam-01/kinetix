import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/config/env";
import * as schema from "./schema";

const queryClient = postgres(serverEnv.DATABASE_URL);

export const db = drizzle(queryClient, { schema });
