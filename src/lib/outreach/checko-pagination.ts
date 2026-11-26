/** На checko.ru пагинация только ?page=N; order=reg_date ломает загрузку. */
export function buildCheckoAdvancedListUrl(
  pageNum: number,
  sortQuery?: string,
): string {
  const params = new URLSearchParams();
  if (pageNum > 1) params.set("page", String(pageNum));
  const query = sortQuery?.trim();
  if (query) {
    for (const part of query.split("&")) {
      const [key, value = ""] = part.split("=");
      if (key) params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/search/advanced?${qs}` : "/search/advanced";
}
