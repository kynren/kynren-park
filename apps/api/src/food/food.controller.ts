import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createOrderSchema, orderStatus } from '@kynren/shared';
import type { CreateOrderInput, OrderStatusValue } from '@kynren/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';
import { FoodService } from './food.service.js';

@ApiTags('food')
@Controller()
export class FoodController {
  constructor(private readonly food: FoodService) {}

  @Public()
  @Get('restaurants')
  restaurants() {
    return this.food.listRestaurants();
  }

  @ApiBearerAuth()
  @Post('orders')
  createOrder(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
  ) {
    return this.food.createOrder(user.sub, body);
  }

  @ApiBearerAuth()
  @Get('orders')
  myOrders(@CurrentUser() user: AuthPrincipal) {
    return this.food.listMyOrders(user.sub);
  }

  // --- Staff (F&B) ----------------------------------------------------------
  @ApiBearerAuth()
  @Roles('FNB')
  @UseGuards(RolesGuard)
  @Get('kitchen/orders')
  kitchenQueue(@Query('restaurantId') restaurantId: string) {
    return this.food.listForRestaurant(restaurantId);
  }

  @ApiBearerAuth()
  @Roles('FNB')
  @UseGuards(RolesGuard)
  @Patch('orders/:id/status')
  updateStatus(@Param('id') id: string, @Body('status', new ZodValidationPipe(orderStatus)) status: OrderStatusValue) {
    return this.food.updateStatus(id, status);
  }
}
