// The browser's end of the Server contract; both clients share it through @mografy/core.
import { apiPath, callApi as call, projectHeaders, readApiResponse } from '@mografy/core';

export { apiPath, projectHeaders, readApiResponse };
/** A request from this page to the Server that served it. */
export const callApi = <T>(path: string, method = 'GET', payload?: unknown, projectDir?: string) => call<T>('', path, method, payload, projectDir);
