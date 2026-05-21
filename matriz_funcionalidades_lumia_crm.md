# Matriz de Maturidade e Análise Comparativa de Produto
**Sistema:** Lumia CRM  
**Segmento:** Mercado Médico e Estética Avançada  
**Data da Análise:** Maio de 2026  
**Status do Documento:** Confidencial / Estratégico  

---

## 1. Sumário Executivo e Posicionamento de Mercado
Este documento serve como ferramenta de inteligência competitiva e auditoria de escopo para o **Lumia CRM**. O objetivo é listar minuciosamente todas as funcionalidades atualmente concebidas e implementadas no sistema, estabelecendo o nível de maturidade técnica do nosso produto frente aos principais concorrentes do ecossistema de saúde estática (ex: *Clinicorp*, *Belle Software*, *GestãoDS*). 

O Lumia CRM diferencia-se pela arquitetura **Light Mode Premium**, foco em **UX fluida para dispositivos móveis**, redução de poluição visual e inteligência algorítmica aplicada à rotina operacional (como o Encaixe Inteligente).

---

## 2. Matriz Geral de Funcionalidades Implementadas

| Módulo Operacional | Funcionalidade Específica | Status no Lumia | Diferencial Competitivo (Lumia CRM vs. Concorrência) |
| :--- | :--- | :---: | :--- |
| **1. Agenda Inteligente** | Visão do Dia (Fidelidade de Minutos) | Criado | Exibe os horários de forma 100% fiel (ex: 14:30), eliminando os arredondamentos visuais comuns em outros CRMs comerciais. |
| **1. Agenda Inteligente** | Visão de Semana (Clean UI) | Criado | Otimizada com a remoção de segundos (`HH:MM`), liberando espaço horizontal crítico para visualização em tablets e desktops. |
| **1. Agenda Inteligente** | Exibição de Múltiplos Profissionais | Criado | Suporta concorrência perfeita. Se houver múltiplos pacientes no mesmo horário para profissionais distintos, os cards dividem o espaço simetricamente. |
| **1. Agenda Inteligente** | Exibição Enriquecida do Card | Criado | Exibe em empilhamento vertical estrito: Horário/Paciente ➔ Procedimento ➔ Nome do Profissional Responsável (abaixo do procedimento). |
| **1. Agenda Inteligente** | Algoritmo de Encaixe Inteligente | Criado | **Diferencial Sênior:** Conectado ao Back-end. Varre toda a grade do dia (multi-profissional), cruza o tempo do procedimento desejado e sugere as brechas reais. |
| **2. Jornada do Cliente** | Pipeline de Atendimento Kanban | Criado | Fluxo visual de esteira (Confirmado ➔ Chegou à Clínica ➔ Em Atendimento ➔ Check-out/Conclusão). |
| **2. Jornada do Cliente** | Alertas Temporais Cromáticos | Criado | **UI Premium:** Monitoramento em tempo real. Faltando ≤ 15min fica Amarelo Pastel (`bg-amber-50`). Atrasado fica Vermelho/Coral Pastel (`bg-rose-50`). |
| **2. Jornada do Cliente** | Persistência Pós-Checkout | Criado | O card do paciente permanece fixo na coluna final como histórico do dia corrente. Não desaparece da esteira após o faturamento. |
| **2. Jornada do Cliente** | Flexibilidade de Infraestrutura | Criado | Remoção da tag fixa de "Cabines", despoluindo o card e focando nas relações humanas (Paciente x Profissional). |
| **3. Prontuário Virtual** | Cabeçalho Cadastral | Criado | Exibição limpa de dados vitais (Nome, Data de Nascimento, Contato e E-mail) em área de destaque. |
| **3. Prontuário Virtual** | Botão Global de Acolhimento | Criado | Botão "Acolher Paciente" no canto superior direito, duplicando o fluxo inteligente e limpo nativo da Jornada do Cliente. |
| **3. Prontuário Virtual** | Ações Rápidas da Ficha | Criado | Bloco compacto no canto direito com hierarquia mista: "Agendar Consulta" (Top CTA) e, abaixo, "Editar Dados" e "Excluir" lado a lado. |
| **3. Prontuário Virtual** | Linha do Tempo de Consultas | Criado | **Carrossel Horizontal Premium:** Mapeia o histórico dividido pelo marcador central "HOJE". Consultas passadas renderizam em cor exclusiva (`bg-slate-50`). |
| **3. Prontuário Virtual** | Sinalização de Estado Vazio | Criado | Tratamento de *Zero Case* para agendamentos futuros através de card pontilhado estético com call-to-action direto para novo agendamento. |
| **4. Gestão Financeira** | Painel "Faturamento de Hoje" | Criado | Dashboard consolidada contendo KPIs macro de faturamento bruto, líquido e métricas operacionais do dia. |
| **4. Gestão Financeira** | Inversão de Origem de Receita | Criado | A listagem de **Procedimentos Realizados** fica no topo (maior visibilidade) e o bloco descritivo de **Métodos de Pagamento** fica logo abaixo. |
| **4. Gestão Financeira** | Filtro Temporal Global | Criado | Seletor dinâmico (*Date Range Picker*) que permite analisar dados históricos de qualquer intervalo de dias passado (D-N). |
| **4. Gestão Financeira** | Trilha de Auditoria (Logs) | Criado | Mecanismo de segurança que grava o usuário, timestamp exato e metadados de rede de cada transação efetuada. |
| **4. Gestão Financeira** | Trava Contábil de Retroatividade | Criado | Lançamentos de dias anteriores são imutáveis; correções exigem lançamentos de estorno/retificação com justificativa obrigatória. |
| **5. Regras de Negócio / Core** | Bloqueio de Conflito de Agenda | Criado | Validação estrita que impede o mesmo paciente de ter dois agendamentos no mesmo horário (seja com o mesmo profissional ou profissionais diferentes). |
| **5. Regras de Negócio / Core** | Feedbacks em Modal Nativa | Criado | Substituição completa de alertas nativos do navegador (`window.alert`) por Modais de Erro customizadas em Light Mode. |
| **6. Engenharia de UI/UX** | Responsividade Mobile Global | Criado | **Core Mandatório:** Adaptação completa para smartphones (iPhone/Android). Tabelas viram listas de cards, carrosséis ganham swipe nativo. |

---

## 3. Detalhamento Técnico das Funcionalidades Implementadas

### MÓDULO 1: AGENDA INTELIGENTE MULTI-PROFISSIONAL
Este módulo é o coração operacional da clínica. Ao contrário de interfaces genéricas de calendário, a Agenda Inteligente do Lumia foi projetada para lidar com a alta densidade de profissionais e salas de clínicas de medicina estética avançada.

* **Algoritmo de Encaixe Inteligente Conectado:** O botão de encaixe dispara um cálculo analítico no back-end. A API varre a tabela de agendamentos filtrando pelo dia escolhido. Ela calcula a diferença de tempo (`fim_agendamento_anterior - inicio_agendamento_proximo`) e gera janelas de ociosidade. Se o intervalo for igual ou maior que o tempo exigido pelo procedimento informado, o sistema mapeia o profissional disponível e renderiza a opção na interface.
* **Precisão Relógio (Fidelidade de Minutos):** Eliminou-se o vício de desenvolvimento de "arredondar" ou "forçar" cards de agendamento a ocuparem blocos fixos de hora em hora. Se um procedimento de injetável é marcado para as 14:30h, ele é renderizado na linha exata de 14:30h.
* **Exibição em Visão Semanal Unificada:** Exibe as colunas dos dias da semana de forma condensada. O formato do tempo descarta os segundos, operando puramente em `HH:MM`, limpando o ruído textual e priorizando a leitura do nome do paciente.
* **Empilhamento de Informação no Card:** O card adota uma arquitetura em formato de lista interna. O horário e o nome do paciente têm peso de título (`font-semibold`); abaixo vem o procedimento; e na base do card, quebrando obrigatoriamente para a linha inferior, fica o nome do profissional executor em fonte reduzida (`text-xs text-neutral-500`), garantindo que a recepção saiba quem executará a aplicação sem precisar abrir o card.

### MÓDULO 2: JORNADA DO CLIENTE (ESTEIRA KANBAN DE ATENDIMENTO)
Gerencia a experiência do paciente desde o momento em que ele confirma a presença até o momento em que sai da clínica após o pagamento, garantindo visibilidade estatística do fluxo de tráfego interno.

* **Fases do Pipeline:** Dividido em quatro colunas fixas horizontais: `Confirmados` → `Chegou à Clínica` → `Em Atendimento` → `Check-out/Conclusão`. O arraste ou a mudança de status altera o estado do paciente em tempo real no banco de dados.
* **Lógica de Monitoramento de Tempo em Tempo Real (Cronômetro de Alerta):** O componente executa um hook de efeito (`useEffect`) que roda um temporizador em background a cada 60 segundos. Ele realiza o cálculo linear da diferença de tempo:
    - Δt = t_agendamento − t_atual
    * Se `0 < Δt ≤ 15 minutos`, o card do paciente recebe dinamicamente a classe de atenção visual em tom pastel suave (ex: `bg-amber-50 border-amber-200 text-amber-900`), indicando proximidade.
    * Se `Δt < 0`, significa que o horário do atendimento já passou e o paciente não foi movido de coluna. O card altera para o tom vermelho/coral pastel (ex: `bg-rose-50 border-rose-200 text-rose-900`), acusando atraso operacional na recepção.
* **Persistência Pós-Checkout:** Retirou-se a antiga regra de sumir com o paciente após o faturamento. O card do paciente que concluiu o pagamento permanece estático na coluna "Check-out/Conclusão" com os dados financeiros sintetizados. A esteira acumula os cards de forma auditável ao longo do dia, reiniciando o cache da visualização apenas na virada de data (`00:00h`).
* **Ajuste de Infraestrutura (Remoção de Cabines):** O card foi limpo visualmente através da remoção completa de referências e etiquetas de "cabines", permitindo um layout mais focado e espaçoso para clínicas que operam com salas flexíveis.

### MÓDULO 3: PRONTUÁRIO VIRTUAL E ANÁLISE ESTÉTICA VISUAL
A central de inteligência clínica do paciente. Combina dados demográficos, histórico de intervenções estéticas e o planejamento de procedimentos futuros em uma única tela integrada.

* **Ações Rápidas de Ficha com Hierarquia Estruturada:** No lado direito da ficha, os botões seguem uma estrutura limpa e de alta conversão visual: O botão principal "Agendar Consulta" fica isolado no topo com fundo preenchido (Primary CTA). Logo abaixo dele, em uma única linha horizontal dividida simetricamente, ficam os botões secundários de "Editar Dados" (estilo outline com ícone de lápis) e "Excluir" (estilo texto/alerta discreto).
* **Duplicação do Botão Global "Acolher Paciente":** Posicionado de forma fixa e isolada no canto superior direito da tela geral do prontuário. Ele replica fielmente a lógica e o comportamento contidos na Jornada do Cliente: abre a modal de acolhimento limpa e em branco, permitindo cadastrar um novo paciente no ecossistema sem que o profissional precise mudar de tela ou sair do prontuário atual.
* **Carrossel Horizontal de Linha do Tempo Dinâmica:** Um componente estilizado que divide o histórico clínico em uma linha do tempo física. Utiliza o divisor textual centralizado "**HOJE**" ancorado verticalmente.
    * **Lado Esquerdo (Passado):** Lista as consultas já finalizadas e faturadas. Para garantir uma diferenciação cromática precisa, estes cards assumem uma cor de fundo fria e neutra exclusiva (ex: `bg-slate-50 border-slate-200`), exibindo o status de "Realizada" em uma tag discreta.
    * **Lado Direito (Futuro):** Mapeia os próximos agendamentos confirmados.
    * **Estado Vazio Tratado (Zero Case):** Caso a API retorne que o paciente não possui nenhuma consulta futura agendada, o lado direito renderiza um bloco estético com bordas tracejadas (`border-dashed`), ícone minimalista de calendário e um texto de suporte: *"Nenhuma consulta futura agendada"*, acompanhado de um botão embutido "Agendar" para capturar a ação imediatamente.

### MÓDULO 4: GESTÃO FINANCEIRA ROBUSTA E AUDITÁVEL
Desenvolvido sob os pilares de segurança contábil e auditoria antifraude, este módulo fornece o controle real do caixa e dos procedimentos faturados na clínica.

* **Inversão Estratégica de Layout:** O painel de faturamento diário prioriza a entrega clínica sobre o método de liquidação. A seção de **Procedimentos Realizados** (mostrando detalhadamente o nome do procedimento, valor cobrado, paciente atendido e profissional executor) fica posicionada no topo da página. O bloco de **Métodos de Pagamento** (que consolida os recebimentos em Pix, Cartões de Crédito/Débito, Dinheiro e Boletos) fica alocado na base, logo abaixo da lista de procedimentos.
* **Filtro Temporal Histórico Global (Date Range Picker):** Localizado no topo do submenú, permite a seleção flexível de períodos (Hoje, Ontem, 7 Dias, Mês Atual ou Período Customizado). Toda a interface consome este parâmetro de data para refazer as queries, permitindo auditorias retroativas completas.
* **Trilha de Auditoria Estrita (Logs):** Cada movimentação financeira dispara um gatilho no back-end que insere um registro imutável em uma tabela de auditoria (`audit_logs`). São gravados: `actor_id`, `checkout_at`, `action` (ex: `CHECKOUT`), `valor`, `client_ip` e `user_agent` do dispositivo.
* **Imutabilidade Retroativa de Caixa (Bloqueio Contábil):** Uma regra de negócio inflexível no back-end impede a edição direta ou a exclusão de lançamentos financeiros cujas datas sejam anteriores ao dia atual (D-1, D-2, …). Se um erro de preenchimento ocorreu no passado, o gestor é obrigado a efetuar um lançamento de retificação/estorno justificado por escrito, mantendo o histórico de lançamentos original intacto para impedir maquiagem de caixa.

### MÓDULO 5: REGRAS DE NEGÓCIO E CORE DE VALIDAÇÃO
Camada de inteligência de dados aplicada no back-end e front-end para evitar conflitos de horários e falhas operacionais humanas.

* **Validação Estrita de Concorrência de Horários:** O motor de validação intercepta a tentativa de criação ou edição de um agendamento e executa três testes lógicos de colisão antes de persistir os dados no banco:
    1. *Mesmo Paciente + Mesmo Profissional + Mesmo Horário* → **Bloqueado.**
    2. *Mesmo Paciente + Profissionais Diferentes + Mesmo Horário* → **Bloqueado** (o paciente não pode ser duplicado fisicamente em duas salas distintas simultaneamente).
    3. *Pacientes Diferentes + Profissionais Diferentes + Mesmo Horário* → **Permitido.**
* **Substituição de Alertas por Modais de UI Customizadas:** O tratamento de erros de validação abandonou o uso de pop-ups nativos do navegador. Quando ocorre um conflito de horário ou falha de auditoria, o sistema intercepta o erro da API e abre uma modal nativa do Lumia CRM em Light Mode, contendo um ícone sutil de aviso em tom amarelo/vermelho discreto, título claro ("Conflito de Horário") e um botão de fechamento estilizado ("Entendido").

---

## 4. Engenharia de UI/UX, Design System e Responsividade

Para manter o ecossistema fiel ao seu propósito de uso, o código segue diretrizes estritas de design:

* **Padrão Light Mode Premium:** Uso de paletas de cores extremamente limpas e desaturadas. Fundos brancos (`bg-white`), superfícies em cinza neutro muito claro (`bg-neutral-50`), textos principais em alta legibilidade (`text-neutral-900`) e textos secundários em tons suaves (`text-neutral-500`). Cores de destaque (como o amarelo e o vermelho dos alertas de tempo da Jornada) utilizam variações pastel com opacidade reduzida para evitar fadiga visual e manter o aspecto sofisticado de um software médico de alto padrão.
* **Responsividade Mandatória para Todos os Dispositivos:**
    * **Telas Maiores (Desktop/Tablets):** Organização horizontal nativa em blocos paralelos, colunas Kanban lado a lado, tabelas financeiras estendidas e carrosséis com paginação por setas flutuantes.
    * **Telas Menores (Smartphones - iPhone/Android):** O layout reestrutura-se de forma fluida. O bloco de botões de ações rápidas do prontuário ganha largura total (`w-full`) ou se recolhe em um menu compacto de fácil acesso ao polegar. A tabela de faturamento e procedimentos realizados deixa de expor colunas horizontais (o que geraria uma barra de rolagem lateral indesejada) e converte-se automaticamente em uma lista vertical de cards empilhados. O carrossel da linha do tempo do prontuário e as colunas da jornada passam a responder nativamente ao gesto de arrastar com o dedo (`touch swipe`), garantindo que o gestor ou profissional consiga operar a clínica inteira perfeitamente de qualquer lugar usando apenas o celular.
