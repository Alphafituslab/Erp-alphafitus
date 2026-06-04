import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import financeiroRouter from "./financeiro";
import vendasRouter from "./vendas";
import estoqueRouter from "./estoque";
import comprasRouter from "./compras";
import qualidadeRouter from "./qualidade";
import rhRouter from "./rh";
import projetosRouter from "./projetos";
import fiscalRouter from "./fiscal";
import relatoriosRouter from "./relatorios";
import producaoRouter from "./producao";
import apsRouter from "./aps";
import rastreabilidadeRouter from "./rastreabilidade";
import usuariosRouter from "./usuarios";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usuariosRouter);
router.use(financeiroRouter);
router.use(vendasRouter);
router.use(estoqueRouter);
router.use(comprasRouter);
router.use(qualidadeRouter);
router.use(rhRouter);
router.use(projetosRouter);
router.use(fiscalRouter);
router.use(relatoriosRouter);
router.use(producaoRouter);
router.use(apsRouter);
router.use(rastreabilidadeRouter);

export default router;
