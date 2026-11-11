import 'dotenv/config';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { databaseError } from '../src/common/filters/all-exceptions.filter.ts';

/** Chạy lệnh con trên DB riêng và chỉ xuất trạng thái, lỗi không phản chiếu URL hoặc nội dung driver chứa secret */
function run(args, url, extra = {}) {
  const result = spawnSync(process.execPath, args, { env: { ...process.env, DATABASE_URL: url, ...extra }, encoding: 'utf8' });
  assert.equal(result.status, 0, `Kiểm tra ${args.join(' ')} thất bại, cần kiểm tra môi trường local riêng`);
}

/** Khởi tạo hai DB local mới theo UUID, không reset hoặc xóa DB nào và giữ fixture để đối chiếu sau kiểm thử */
async function verify() {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname), 'Chỉ kiểm VC03 trên PostgreSQL local');
  target.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: target.href });
  await admin.connect();
  const suffix = randomUUID().replaceAll('-', '');
  const names = [`vc03_test_${suffix}`, `vc03_test_upgrade_${suffix}`];
  try {
    for (const name of names) await admin.query(`CREATE DATABASE "${name}"`);
  } finally { await admin.end(); }
  const migrations = (await readdir('prisma/migrations')).filter(name => /^\d/.test(name)).sort();
  const urls = names.map(name => { const url = new URL(target); url.pathname = `/${name}`; return url.href; });
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], urls[0]);
  // So sánh schema với DB vừa migrate, exit-code khác không chứng minh thiếu cột/index/FK hoặc sai default
  run(['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],urls[0]);
  // Credential seed chỉ ở thư mục tạm riêng, dọn đúng tệp đã tạo và không in mật khẩu hoặc đường dẫn secret
  const seedDirectory = await mkdtemp(join(tmpdir(), 'vc03-seed-'));
  const seedFile = join(seedDirectory,'credentials.json');
  try { run(['--import','tsx','prisma/seed.ts'],urls[0],{SEED_CREDENTIALS_FILE:seedFile}); }
  finally { await unlink(seedFile).catch(() => {}); await rmdir(seedDirectory); }
  console.log('Đạt seed DB mới với trigger thời hạn đang bật');
  const upgrade = new pg.Client({ connectionString: urls[1] });
  await upgrade.connect();
  const existingId = randomUUID();
  try {
    // Mô phỏng đúng mốc VC02 bằng SQL cũ, thêm user trước upgrade để chứng minh cột version không bị tạo lại hoặc mất dữ liệu
    for (const name of migrations.slice(0, -1)) await upgrade.query(await readFile(`prisma/migrations/${name}/migration.sql`, 'utf8'));
    await upgrade.query(`INSERT INTO users(id,username,password_hash,full_name,role,created_at,updated_at) VALUES ($1,'giu-user','hash','Người dùng nâng cấp','ADMIN',now(),now())`, [existingId]);
    await upgrade.query(await readFile(`prisma/migrations/${migrations.at(-1)}/migration.sql`, 'utf8'));
    assert.equal((await upgrade.query('SELECT credential_version FROM users WHERE id=$1', [existingId])).rows[0].credential_version, 0);
  } finally { await upgrade.end(); }
  console.log('Đạt migrate DB trống và nâng cấp giữ user/version 0');

  const db = new pg.Client({ connectionString: urls[0], options: '-c timezone=UTC' });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: urls[0], options: '-c timezone=UTC' }) });
  await db.connect();
  const user = randomUUID(), unit = randomUUID(), period = randomUUID(), criterion = randomUUID(), score = randomUUID(), evaluation = randomUUID();
  /** Mỗi lỗi SQL mong đợi có mã hoặc rule cố định, không dựa vào câu tiếng Anh từ PostgreSQL để quyết định nghiệp vụ */
  async function rejected(sql, params, code, rule) {
    await assert.rejects(db.query(sql, params), error => error.code === code && (!rule || error.constraint === rule));
  }
  try {
    await db.query(`INSERT INTO users(id,username,password_hash,full_name,role,created_at,updated_at) VALUES ($1,'vc03','hash','Quản trị kiểm thử','ADMIN',now(),now())`, [user]);
    await db.query(`INSERT INTO units(id,code,name,created_at,updated_at) VALUES ($1,'VC03','Đơn vị kiểm thử',now(),now())`, [unit]);
    await db.query(`INSERT INTO evaluation_periods(id,year,name,created_by_id,published_at,self_eval_start,self_eval_deadline,created_at,updated_at) VALUES ($1,2090,'Kỳ kiểm thử',$2,now()-interval '2 hour',now()-interval '1 hour',now()+interval '1 hour',now(),now())`, [period,user]);
    await db.query(`INSERT INTO criteria(id,period_id,code,name,max_score,sort_order,created_at,updated_at) VALUES ($1,$2,'L','Tiêu chí lá',10,1,now(),now())`, [criterion,period]);
    await db.query(`INSERT INTO evaluations(id,period_id,unit_id,created_at,updated_at) VALUES ($1,$2,$3,now(),now())`, [evaluation,period,unit]);
    await db.query(`INSERT INTO criterion_scores(id,evaluation_id,criterion_id,self_score,created_at,updated_at) VALUES ($1,$2,$3,5,now(),now())`, [score,evaluation,criterion]);
    // Giữ các ràng buộc sẵn có khi thay function, tiêu chí cha không được chấm và tiêu chí kỳ khác không được gắn hồ sơ
    const parent = randomUUID(), otherPeriod = randomUUID(), otherCriterion = randomUUID();
    await db.query(`INSERT INTO criteria(id,period_id,code,name,max_score,sort_order,created_at,updated_at) VALUES ($1,$2,'P','Tiêu chí cha',10,0,now(),now())`,[parent,period]);
    await db.query('UPDATE criteria SET parent_id=$1 WHERE id=$2',[parent,criterion]);
    await rejected(`INSERT INTO criterion_scores(id,evaluation_id,criterion_id,self_score,created_at,updated_at) VALUES ($1,$2,$3,1,now(),now())`,[randomUUID(),evaluation,parent],'23514','SCORE_LEAF');
    await db.query(`INSERT INTO evaluation_periods(id,year,name,created_by_id,created_at,updated_at) VALUES ($1,2091,'Kỳ khác',$2,now(),now())`,[otherPeriod,user]);
    await rejected('UPDATE criteria SET period_id=$1 WHERE id=$2',[otherPeriod,criterion],'23514','CRITERION_PARENT_PERIOD');
    await db.query(`INSERT INTO criteria(id,period_id,code,name,max_score,sort_order,created_at,updated_at) VALUES ($1,$2,'O','Tiêu chí khác kỳ',10,0,now(),now())`,[otherCriterion,otherPeriod]);
    await rejected(`INSERT INTO criterion_scores(id,evaluation_id,criterion_id,self_score,created_at,updated_at) VALUES ($1,$2,$3,1,now(),now())`,[randomUUID(),evaluation,otherCriterion],'23514','SCORE_PERIOD');
    await rejected('UPDATE criterion_scores SET self_score=11 WHERE id=$1',[score],'23514','SCORE_MAX');
    await db.query(`UPDATE evaluation_periods SET self_eval_start=now()+interval '1 hour',self_eval_deadline=now()+interval '2 hour' WHERE id=$1`,[period]);
    await rejected('UPDATE criterion_scores SET self_score=6 WHERE id=$1',[score],'23514','SELF_EVALUATION_LOCKED');
    await db.query(`UPDATE evaluations SET status='SUPPLEMENT_REQUESTED',supplement_deadline=now()+interval '1 hour' WHERE id=$1`,[evaluation]);
    await db.query('UPDATE criterion_scores SET needs_supplement=true WHERE id=$1',[score]);
    assert.equal((await db.query('SELECT supplemented_at FROM criterion_scores WHERE id=$1',[score])).rows[0].supplemented_at,null);
    await db.query("UPDATE criterion_scores SET admin_score=7,admin_comment='Đã thẩm định',reviewed_by_id=$1,reviewed_at=now() WHERE id=$2",[user,score]);
    await db.query('UPDATE criterion_scores SET self_score=6 WHERE id=$1',[score]);
    assert.ok((await db.query('SELECT supplemented_at FROM criterion_scores WHERE id=$1',[score])).rows[0].supplemented_at);
    assert.equal((await db.query('SELECT admin_score FROM criterion_scores WHERE id=$1',[score])).rows[0].admin_score,null);
    // Trong cùng câu lệnh thời điểm deadline bằng statement_timestamp chính xác, không dùng sleep dễ gây test chập chờn
    await rejected(`WITH deadline AS (UPDATE evaluations SET supplement_deadline=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING id) UPDATE criterion_scores SET self_score=7 WHERE id=$2 AND (SELECT count(*) FROM deadline)=1`,[evaluation,score],'23514','SELF_EVALUATION_LOCKED');
    await db.query(`UPDATE evaluations SET supplement_deadline=now()+interval '1 hour' WHERE id=$1`,[evaluation]);
    const evidence = randomUUID();
    await db.query(`INSERT INTO evidences(id,criterion_score_id,uploader_id,kind,round,external_url,created_at) VALUES ($1,$2,$3,'LINK','SUPPLEMENT','https://example.com',now())`,[evidence,score,user]);
    await rejected(`WITH deadline AS (UPDATE evaluations SET supplement_deadline=statement_timestamp() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING id) DELETE FROM evidences WHERE id=$2 AND (SELECT count(*) FROM deadline)=1`,[evaluation,evidence],'23514','EVIDENCE_LOCKED');
    await db.query(`UPDATE evaluations SET supplement_deadline=now()-interval '1 second' WHERE id=$1`,[evaluation]);
    await rejected('DELETE FROM evidences WHERE id=$1',[evidence],'23514','EVIDENCE_LOCKED');
    await db.query(`INSERT INTO audit_logs(id,actor_id,action,entity,entity_id,created_at) VALUES ($1,$2::uuid,'TEST','User',$2::text,now())`,[randomUUID(),user]);
    await rejected('DELETE FROM audit_logs WHERE actor_id=$1',[user],'23514','HISTORY_APPEND_ONLY');
    const history = randomUUID();
    await db.query(`INSERT INTO status_histories(id,evaluation_id,actor_id,to_status,created_at) VALUES ($1,$2,$3,'DRAFT',now())`,[history,evaluation,user]);
    await rejected("UPDATE status_histories SET comment='Đổi lịch sử' WHERE id=$1",[history],'23514','HISTORY_APPEND_ONLY');
    await rejected('DELETE FROM users WHERE id=$1',[user],'23503');
    await rejected(`INSERT INTO evaluation_periods(id,year,name,created_by_id,created_at,updated_at) VALUES ($1,2090,'Trùng năm',$2,now(),now())`,[randomUUID(),user],'23505');
    // Kiểm lease rỗng hợp lệ và lease thiếu bị từ chối, unique user/version ngăn tạo lại dispatch cùng credential
    const dispatch = randomUUID();
    await db.query(`INSERT INTO credential_dispatches(id,user_id,credential_version,ciphertext,nonce,tag,key_id,created_at,expires_at) VALUES ($1,$2,0,$3,$4,$5,'test',now(),now()+interval '1 hour')`,[dispatch,user,Buffer.from('x'),Buffer.alloc(12),Buffer.alloc(16)]);
    const delivery = randomUUID();
    await db.query(`INSERT INTO credential_deliveries(id,dispatch_id,channel,created_at,updated_at) VALUES ($1,$2,'EMAIL',now(),now())`,[delivery,dispatch]);
    await rejected('UPDATE credential_deliveries SET claim_token=$1 WHERE id=$2',[randomUUID(),delivery],'23514');
    await rejected("UPDATE credential_deliveries SET status='PROCESSING' WHERE id=$1",[delivery],'23514');
    await rejected(`INSERT INTO credential_dispatches(id,user_id,credential_version,ciphertext,nonce,tag,key_id,created_at,expires_at) SELECT $1,user_id,credential_version,ciphertext,nonce,tag,key_id,created_at,expires_at FROM credential_dispatches WHERE id=$2`,[randomUUID(),dispatch],'23505');
    // Import chỉ xác nhận khi có kết quả, token không được có TTL âm và Zalo không được lưu nonce sai kích thước
    const session = randomUUID(), onboarding = randomUUID(), zalo = randomUUID();
    await db.query(`INSERT INTO import_sessions(id,admin_id,rows,digest,idempotency_key,created_at,expires_at) VALUES ($1,$2,'[]',$3,'confirm-test',now(),now()+interval '1 hour')`,[session,user,'a'.repeat(64)]);
    await rejected("UPDATE import_sessions SET status='CONFIRMED' WHERE id=$1",[session],'23514');
    await db.query(`UPDATE import_sessions SET status='CONFIRMED',confirmed_at=now(),result='{"created":0}' WHERE id=$1`,[session]);
    await db.query(`INSERT INTO onboarding_tokens(id,user_id,credential_version,token_hash,created_at,expires_at) VALUES ($1,$2,0,$3,now(),now()+interval '15 minute')`,[onboarding,user,'b'.repeat(64)]);
    await rejected('UPDATE onboarding_tokens SET expires_at=created_at WHERE id=$1',[onboarding],'23514');
    await db.query(`INSERT INTO zalo_connections(id,oa_id,ciphertext,nonce,tag,key_id,expires_at,created_at,updated_at) VALUES ($1,'oa-test',$2,$3,$4,'test',now()+interval '1 hour',now(),now())`,[zalo,Buffer.from('token-ma-hoa'),Buffer.alloc(12),Buffer.alloc(16)]);
    await rejected('UPDATE zalo_connections SET nonce=$1 WHERE id=$2',[Buffer.alloc(1),zalo],'23514');
    // Nullable unitId cho nhiều admin nhưng một đơn vị chỉ có một tài khoản, kiểm index partial thật thay vì suy luận từ Prisma
    await db.query(`INSERT INTO users(id,username,password_hash,full_name,role,unit_id,created_at,updated_at) VALUES ($1,'unit-vc03','hash','Đơn vị','UNIT',$2,now(),now())`,[randomUUID(),unit]);
    await rejected(`INSERT INTO users(id,username,password_hash,full_name,role,unit_id,created_at,updated_at) VALUES ($1,'unit-vc03-duplicate','hash','Đơn vị trùng','UNIT',$2,now(),now())`,[randomUUID(),unit],'23505');
    await db.query(`INSERT INTO users(id,username,password_hash,full_name,role,created_at,updated_at) VALUES ($1,'admin-null','hash','Admin không có đơn vị','ADMIN',now(),now())`,[randomUUID()]);
    // Timestamp không timezone phải round-trip đúng mốc giờ Việt Nam qua adapter đã cấu hình UTC
    const vietnamTime = new Date('2026-11-25T07:00:00+07:00');
    await prisma.unit.update({where:{id:unit},data:{updatedAt:vietnamTime}});
    assert.equal((await prisma.unit.findUniqueOrThrow({where:{id:unit}})).updatedAt.toISOString(),'2026-11-25T00:00:00.000Z');
    // Đọc qua generated client và lỗi adapter thật ở cả model lẫn raw, filter phải giữ response tiếng Việt không chứa SQL
    assert.equal((await prisma.credentialDispatch.findUniqueOrThrow({where:{id:dispatch}})).credentialVersion,0);
    for (const query of [() => prisma.criterionScore.update({where:{id:score},data:{selfScore:11}}), () => prisma.$executeRaw`UPDATE criterion_scores SET self_score=11 WHERE id=${score}::uuid`]) {
      try { await query(); assert.fail('Cần có lỗi quy tắc DB'); } catch (error) {
        const safe=databaseError(error); assert.equal(safe?.code,'DB_RULE_VIOLATION');
        assert.equal(safe.message,'Dữ liệu không đáp ứng quy tắc của hệ thống.');
      }
    }
    assert.equal((await db.query(`SELECT current_setting('TimeZone') AS zone`)).rows[0].zone,'UTC');
    console.log('Đạt trigger thời hạn/điểm/minh chứng, append-only, FK, unique, lease và lỗi Prisma thật');
  } finally { await db.end(); await prisma.$disconnect(); }
  // Regression dùng DB đã nâng schema mới, test tự thêm UUID riêng và không gửi thông báo ra ngoài
  const regression = names[0].replace('vc03_test_', 'vc02_test_vc03_');
  const control = new pg.Client({connectionString:target.href}); await control.connect();
  try { await control.query(`CREATE DATABASE "${regression}" TEMPLATE "${names[0]}"`); } finally { await control.end(); }
  const authUrl = new URL(urls[0]); authUrl.pathname=`/${regression}`;
  run(['--import','tsx','--test','test/integration/vc02.integration.test.ts'],authUrl.href,{VC02_TEST_DATABASE_URL:authUrl.href});
  console.log('Đạt regression Auth PostgreSQL 7/7 trên schema VC03');
  console.log(`DB bằng chứng: ${names.join(', ')}, ${regression}`);
}

// Chỉ in thông báo dự án kiểm soát khi thất bại, không in stack/URL/driver có thể chứa thông tin kết nối
verify().catch(error => { console.error('Kiểm chứng VC03 thất bại, cần rà soát bước kiểm tra trên DB test riêng', {code:error.code, rule:error.constraint, location:error.stack?.split('\n').filter(line => line.trim().startsWith('at ')).slice(0,3)}); process.exitCode=1; });
