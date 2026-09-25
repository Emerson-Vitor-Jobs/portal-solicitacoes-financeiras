import { useRef } from 'react';

// Trava síncrona contra envio duplo. O `isPending` do TanStack Query só desabilita o botão depois
// do próximo render; dois cliques no mesmo quadro passariam os dois. A trava fecha no primeiro
// clique, antes de qualquer render, e abre quando a requisição termina (ou a validação falha).
export function useSubmitLock() {
  const locked = useRef(false);
  return {
    tryAcquire(): boolean {
      if (locked.current) return false;
      locked.current = true;
      return true;
    },
    release(): void {
      locked.current = false;
    },
  };
}
