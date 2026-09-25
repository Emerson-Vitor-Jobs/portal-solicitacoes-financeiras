import createClient from 'openapi-fetch';
import { expectTypeOf, test } from 'vitest';
import type { components, paths } from './schema';

type Detail = components['schemas']['RequestDetail'];
type Problem = components['schemas']['Problem'];

test('contract generated from the back-end openapi.json', () => {
  expectTypeOf<Detail['amount_cents']>().toEqualTypeOf<number>();
  expectTypeOf<Detail['due_date']>().toEqualTypeOf<string>();
  expectTypeOf<Detail['paid_at']>().toEqualTypeOf<string | null>();
  expectTypeOf<Detail['status']>().toEqualTypeOf<'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'>();
  expectTypeOf<Problem['code']>().toExtend<string>();

  const client = createClient<paths>({ baseUrl: '' });
  expectTypeOf(client.GET).toBeFunction();
});
