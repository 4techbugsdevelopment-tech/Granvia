import { Request } from 'express';

const GRANVIA_PUBLIC_API_URL = 'https://aip.granvia.llc';

export function requestBaseUrl(_req: Request): string {
  return GRANVIA_PUBLIC_API_URL;
}
