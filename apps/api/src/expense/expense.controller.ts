import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { toLimit, toPage } from "../common/pagination";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { GetExpensesQueryDto } from "./dto/get-expenses-query.dto";
import { ExpenseService } from "./expense.service";

@Controller("expenses")
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto) {
    return this.expenseService.create(dto);
  }

  @Get()
  findAll(@Query() query: GetExpensesQueryDto) {
    return this.expenseService.findAll(toPage(query), toLimit(query));
  }

  @Delete("group/:groupId")
  removeGroup(@Param("groupId") groupId: string) {
    return this.expenseService.removeGroup(groupId);
  }
}
