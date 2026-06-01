import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import financeiroRouter from "./financeiro";
import vendasRouter from "./vendas";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(financeiroRouter);
router.use(vendasRouter);

export default router;
