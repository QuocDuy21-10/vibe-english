export type PaginationItem = number | "ellipsis";

export type PaginationModel = {
  totalPages: number;
  currentPage: number;
  startIndex: number;
  endIndex: number;
  pageItems: PaginationItem[];
};

export function getVisiblePageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis", totalPages];
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

export function getPaginationModel(totalItems: number, pageSize: number, requestedPage: number): PaginationModel {
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize));
  const currentPage = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage)));
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, Math.max(0, totalItems));

  return {
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    pageItems: getVisiblePageItems(currentPage, totalPages)
  };
}
