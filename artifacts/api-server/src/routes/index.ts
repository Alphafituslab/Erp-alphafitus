import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import financeiroRouter from "./financeiro";
import vendasRouter from "./vendas";
import estoqueRouter from "./estoque";
import comprasRouter from "./compras";
import qualidadeRouter from "./qualidade";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(financeiroRouter);
router.use(vendasRouter);
router.use(estoqueRouter);
router.use(comprasRouter);
router.use(qualidadeRouter);

export default router;
