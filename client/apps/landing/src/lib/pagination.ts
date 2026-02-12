export interface PaginationWindowInput {
  currentPage: number;
  totalPages: number;
  maxVisiblePages: number;
}

export interface PaginationWindowResult {
  pages: number[];
  showFirst: boolean;
  showLast: boolean;
}

export function getPaginationWindow({
  currentPage,
  totalPages,
  maxVisiblePages,
}: PaginationWindowInput): PaginationWindowResult {
  if (totalPages <= 0) {
    return { pages: [], showFirst: false, showLast: false };
  }

  const safeCurrent = Math.min(Math.max(currentPage, 1), totalPages);
  const safeMax = Math.max(maxVisiblePages, 1);
  const halfWindow = Math.floor(safeMax / 2);

  const startPage = Math.max(1, safeCurrent - halfWindow);
  const endPage = Math.min(totalPages, startPage + safeMax - 1);
  const adjustedStartPage = Math.max(1, endPage - safeMax + 1);

  const pages = Array.from({ length: endPage - adjustedStartPage + 1 }, (_, index) => adjustedStartPage + index);

  return {
    pages,
    showFirst: adjustedStartPage > 1,
    showLast: endPage < totalPages,
  };
}
