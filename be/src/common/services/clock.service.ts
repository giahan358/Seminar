import { Injectable } from "@nestjs/common";

@Injectable()
export class ClockService {
  private fixedTime?: Date;

  now(): Date {
    return new Date(this.fixedTime ?? Date.now());
  }

  set(time: Date | string | number): void {
    this.fixedTime = new Date(time);
  }

  reset(): void {
    this.fixedTime = undefined;
  }
}
