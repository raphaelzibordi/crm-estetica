import type { PostgrestError, AuthError } from '@supabase/supabase-js';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  'invalid login credentials': 'E-mail ou senha incorretos. Verifique seus dados e tente novamente.',
  'email not confirmed': 'Confirme seu e-mail antes de acessar o Lumina.',
  'user already registered': 'Este e-mail já possui cadastro. Faça login para continuar.',
  'password should be at least 6 characters': 'A senha precisa ter no mínimo 6 caracteres.',
  'invalid email': 'Informe um e-mail válido.',
  'email rate limit exceeded':
    'Muitos cadastros recentes deste e-mail. Aguarde alguns minutos para tentar novamente.',
};

const POSTGREST_HTTP_TO_STATUS: Record<string, number> = {
  '23505': 409, // unique_violation
  '23503': 409, // foreign_key_violation
  '23502': 400, // not_null_violation
  '42501': 403, // insufficient_privilege (RLS)
  'PGRST301': 401, // JWT expirado
};

function isPostgrestError(err: unknown): err is PostgrestError {
  return Boolean(
    err && typeof err === 'object' && 'code' in err && 'message' in err && 'details' in err
  );
}

function isAuthError(err: unknown): err is AuthError {
  return Boolean(
    err &&
      typeof err === 'object' &&
      'status' in err &&
      'message' in err &&
      (err as any).name?.toString().includes('Auth')
  );
}

export function humanizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (isAuthError(err)) {
    const raw = err.message?.toLowerCase() ?? '';
    const known = Object.keys(AUTH_MESSAGES).find((k) => raw.includes(k));
    const friendly = known
      ? AUTH_MESSAGES[known]
      : 'Não foi possível concluir a autenticação. Tente novamente em instantes.';
    return new ApiError(friendly, err.status ?? 401, 'AUTH_ERROR');
  }

  if (isPostgrestError(err)) {
    const status = POSTGREST_HTTP_TO_STATUS[err.code] ?? 500;
    if (err.code === '42501') {
      return new ApiError(
        'Acesso negado: você não tem permissão para acessar este recurso.',
        403,
        err.code
      );
    }
    if (err.code === '23505') {
      return new ApiError('Registro duplicado: este item já existe no sistema.', 409, err.code);
    }
    if (err.code === '23503') {
      return new ApiError(
        'Não foi possível concluir a operação: referência ao banco inválida.',
        409,
        err.code
      );
    }
    if (err.code === 'PGRST301' || err.code === 'PGRST302') {
      return new ApiError(
        'Sua sessão expirou. Faça login novamente para continuar.',
        401,
        err.code
      );
    }
    return new ApiError(
      err.message ||
        'Falha ao comunicar com o banco de dados. Tente novamente em alguns instantes.',
      status,
      err.code
    );
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
      return new ApiError(
        'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
        503,
        'NETWORK_ERROR'
      );
    }
    return new ApiError(err.message, 500);
  }

  return new ApiError('Ocorreu um erro inesperado. Tente novamente.', 500);
}

export function isUnauthorized(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 401 || err.status === 403;
  if (isAuthError(err)) return (err.status ?? 0) === 401 || (err.status ?? 0) === 403;
  if (isPostgrestError(err)) return err.code === 'PGRST301' || err.code === '42501';
  return false;
}
