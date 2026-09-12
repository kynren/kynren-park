import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators.js';
import { WeatherService } from './weather.service.js';

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Public()
  @Get()
  async current() {
    try {
      return await this.weather.current();
    } catch {
      throw new ServiceUnavailableException('Weather is temporarily unavailable');
    }
  }
}
