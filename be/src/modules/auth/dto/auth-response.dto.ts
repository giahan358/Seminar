import { ApiProperty } from "@nestjs/swagger";

/** Hồ sơ công khai dùng chung cho login/refresh/đổi mật khẩu, không khai báo hash hoặc version để Swagger không khuyến khích lộ dữ liệu */
export class SafeAuthUserDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: String }) fullName!: string;
  @ApiProperty({ type: String, enum: ["ADMIN", "UNIT"] }) role!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) unitId!: string | null;
  @ApiProperty({ type: Boolean }) mustChangePassword!: boolean;
}
/** Mô tả cặp token nhận sau commit, client phải thay cả hai token và hồ sơ thay vì giữ access cũ sau đổi mật khẩu */
export class AuthTokenPairDto {
  @ApiProperty({ type: String, description: "Access token có chữ ký HS256 và version credential hiện hành" }) accessToken!: string;
  @ApiProperty({ type: String, description: "Mã làm mới opaque, dùng một lần để xoay phiên" }) refreshToken!: string;
  @ApiProperty({ type: String, enum: ["Bearer"] }) tokenType!: string;
  @ApiProperty({ type: Number, example: 900, description: "Thời hạn access token tính bằng giây theo cấu hình" }) expiresIn!: number;
  @ApiProperty({ type: SafeAuthUserDto }) user!: SafeAuthUserDto;
}
/** Đơn vị công khai của chủ phiên, chỉ trả các trường cần hiển thị và không lộ trạng thái hay thông tin nội bộ */
export class AuthUnitDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true }) unitType!: string | null;
}
/** Me bổ sung đơn vị hiện tại vào hồ sơ an toàn, ADMIN không gắn đơn vị luôn nhận null */
export class AuthMeDto extends SafeAuthUserDto {
  @ApiProperty({ type: AuthUnitDto, nullable: true }) unit!: AuthUnitDto | null;
}
/** Logout idempotent xác nhận xử lý yêu cầu thu hồi kể cả token lạ hoặc đã thu hồi trước đó */
export class AuthLogoutDto {
  @ApiProperty({ type: Boolean, example: true }) success!: boolean;
}
