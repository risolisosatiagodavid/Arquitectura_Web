import type { Request, Response } from 'express';

import { getInventoryReport } from '../services/report.service.js';

export const inventory = async (request: Request, response: Response) => {
  const report = await getInventoryReport(request.authenticatedUser!.id);
  response.json(report);
};
