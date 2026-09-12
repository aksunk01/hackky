import "server-only";

import mysql, { type Pool } from "mysql2/promise";

const globalPools = globalThis as typeof globalThis & { interviewMysqlPool?: Pool };

export function getPool(): Pool {
  if (globalPools.interviewMysqlPool) return globalPools.interviewMysqlPool;

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || !database || process.env.MYSQL_PASSWORD === undefined) {
    throw new Error("MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.");
  }

  const port = Number(process.env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }

  const useSsl = process.env.MYSQL_SSL === "1";
  globalPools.interviewMysqlPool = mysql.createPool({
    host,
    port,
    user,
    password: process.env.MYSQL_PASSWORD,
    database,
    ssl: useSsl
      ? { rejectUnauthorized: true, ...(process.env.MYSQL_SSL_CA ? { ca: process.env.MYSQL_SSL_CA } : {}) }
      : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    queueLimit: 20,
    connectTimeout: 10_000,
    timezone: "Z",
    dateStrings: true,
  });
  return globalPools.interviewMysqlPool;
}

export function describeDatabaseError(error: unknown): string {
  const coded = error as { code?: unknown; message?: unknown };
  if (typeof coded.code === "string") return coded.code;
  if (typeof coded.message === "string" &&
      (coded.message.startsWith("MySQL is not configured.") || coded.message.startsWith("MYSQL_PORT must"))) {
    return coded.message;
  }
  return "unknown database error";
}
