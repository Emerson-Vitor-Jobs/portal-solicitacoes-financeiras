import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Center,
  Image,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { errorMessage, hasCode, isApiError, tooManyRequestsMessage } from '../../api/errors';
import illustration from '../../assets/doodles/sitting-reading.svg';
import { palette } from '../../theme';
import { login, sessionQueryKey } from './api';
import type { LoginLocationState } from './SessionExpiryListener';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe a senha.'),
});
type LoginForm = z.infer<typeof loginSchema>;

// Mensagem do erro do login. Credencial inválida não diz qual dos dois campos errou (§5.2).
function loginErrorMessage(error: unknown): string {
  if (hasCode(error, 'INVALID_CREDENTIALS')) return 'E-mail ou senha inválidos.';
  if (isApiError(error) && error.code === 'TOO_MANY_REQUESTS') {
    return tooManyRequestsMessage(error.retryAfterSeconds);
  }
  return errorMessage(error);
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = (location.state ?? {}) as LoginLocationState;

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      // A sessão completa (com reference_date) vem do /auth/me, que o RequireAuth busca de novo.
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      await navigate(state.from ?? '/', { replace: true });
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
        for (const fieldError of error.fieldErrors) {
          if (fieldError.field === 'email' || fieldError.field === 'password') {
            form.setError(fieldError.field, { message: fieldError.message });
          }
        }
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));
  const { errors } = form.formState;

  return (
    // Fundo creme da marca, com a ilustração ao lado do formulário (some em telas estreitas), como a tela de
    // entrada do sistema visual (§17).
    <Center mih="100vh" p="md" bg={palette.cream}>
      <SimpleGrid
        cols={{ base: 1, md: 2 }}
        spacing={48}
        w="100%"
        maw={960}
        style={{ alignItems: 'center' }}
      >
        <Stack visibleFrom="md" gap="md">
          <Image src={illustration} alt="" maw={360} />
          <Title order={1} size="h2">
            Portal de Solicitações Financeiras
          </Title>
          <Text c={palette.textSecondary} maw={380}>
            Cadastre despesas, acompanhe a aprovação e o pagamento, com o histórico de cada etapa.
          </Text>
        </Stack>
        <Box>
          <Paper withBorder shadow="sm" p="xl" w="100%" maw={420} mx="auto">
            <form onSubmit={(event) => void onSubmit(event)} noValidate>
              <Stack>
                <Stack gap={4}>
                  <Title order={2}>Entrar</Title>
                  <Text size="sm" c={palette.textSecondary}>
                    Use o e-mail e a senha do seu perfil.
                  </Text>
                </Stack>
                {state.expired && !mutation.isError && (
                  <Alert color="yellow">Sua sessão expirou. Entre novamente.</Alert>
                )}
                {mutation.isError && (
                  <Alert color="red" role="alert">
                    {loginErrorMessage(mutation.error)}
                  </Alert>
                )}
                <TextInput
                  label="E-mail"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  {...form.register('email')}
                  error={errors.email?.message}
                />
                <PasswordInput
                  label="Senha"
                  autoComplete="current-password"
                  {...form.register('password')}
                  error={errors.password?.message}
                />
                <Button
                  type="submit"
                  size="md"
                  fullWidth
                  loading={mutation.isPending}
                  disabled={mutation.isPending}
                >
                  Entrar
                </Button>
              </Stack>
            </form>
          </Paper>
        </Box>
      </SimpleGrid>
    </Center>
  );
}
