import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

/** Mô tả một ngưỡng trong mảng body, khai báo kiểu Swagger tường minh vì tsx không phát design:type như bản build tsc */
export class UpsertRatingThresholdDto {
  /** Mã xếp loại giữ định danh kỹ thuật dạng chuỗi để service ghép khóa kỳ và mức xếp loại khi upsert */
  @ApiProperty({ type: String, example: "EXCELLENT" })
  @IsString({ message: "Mức xếp loại phải là chuỗi" })
  @IsNotEmpty({ message: "Mức xếp loại không được để trống" })
  rating!: string;

  /** Nhãn hiển thị nhận chuỗi tiếng Việt không rỗng, độc lập với mã xếp loại dùng trong dữ liệu */
  @ApiProperty({ type: String, example: "Xuất sắc" })
  @IsString({ message: "Tên mức xếp loại phải là chuỗi" })
  @IsNotEmpty({ message: "Tên mức xếp loại không được để trống" })
  label!: string;

  /** Tỷ lệ cận dưới là số từ 0 đến 100, khai báo Number để Swagger không hiểu nhầm thành tham chiếu vòng khi chạy dev */
  @ApiProperty({ type: Number, example: 90 })
  @IsNumber({}, { message: "Tỷ lệ tối thiểu phải là số" })
  @Min(0, { message: "Tỷ lệ tối thiểu không được nhỏ hơn 0" })
  @Max(100, { message: "Tỷ lệ tối thiểu không được lớn hơn 100" })
  minPercent!: number;

  /** Cờ tùy chọn phân biệt cận dưới loại trừ với bao gồm, bỏ trống thì service dùng false theo giao ước hiện có */
  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean({ message: "Điều kiện ngưỡng phải là đúng hoặc sai" })
  minExclusive?: boolean;

  /** Màu hiển thị có thể là chuỗi hoặc null, vẫn khai báo kiểu chuỗi để giữ nullable đúng trên cả tsx và tsc */
  @ApiPropertyOptional({ type: String, example: "#16a34a", nullable: true })
  @IsOptional()
  @IsString({ message: "Màu sắc phải là chuỗi" })
  color?: string | null;
}
