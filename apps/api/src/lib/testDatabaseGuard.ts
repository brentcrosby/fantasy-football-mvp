export function assertTestDatabaseUrl(databaseUrl = process.env.DATABASE_URL): URL {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for integration tests.");
  }

  const parsedUrl = new URL(databaseUrl);

  if (parsedUrl.searchParams.get("schema") !== "test") {
    throw new Error('Integration tests require DATABASE_URL to include the exact query parameter "schema=test".');
  }

  return parsedUrl;
}
