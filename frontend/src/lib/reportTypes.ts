/** Shared contract for new report APIs; existing operational API shapes are unchanged. */
export type ReportWarning = { code: string; section: string; message: string };
export type ReportResponse<Row, Summary> = {
  items: Row[];
  summary: Summary;
  pagination: { page: number; page_size: number; total: number; total_pages: number };
  meta: {
    scope: Record<string, string>;
    filters: Record<string, unknown>;
    date_basis: string | null;
    timezone: 'Asia/Kolkata';
    generated_at: string;
    partial: boolean;
    warnings: ReportWarning[];
  };
};
