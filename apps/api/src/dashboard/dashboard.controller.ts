import { Controller, Get, Query } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @Query("businessLineId") businessLineId?: string,
    @Query("localMidnight") localMidnight?: string,
  ) {
    const midnight = localMidnight ? new Date(localMidnight) : undefined;
    return this.dashboardService.getDashboard(businessLineId, midnight);
  }
}
