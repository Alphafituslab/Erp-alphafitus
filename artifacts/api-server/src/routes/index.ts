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
import adminRouter from "./admin";
import settingsRouter from "./settings";
import notificationsRouter from "./notifications";
import priceTablesRouter from "./price-tables";
import paymentTermsRouter from "./payment-terms";
import carriersRouter from "./carriers";

const router: IRouter = Router();

// Disable caching for all API responses.
// Without this, Express's default ETags cause the browser to cache 401
// responses and return them (via 304) even after the user logs in.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

router.use(settingsRouter);
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
router.use(adminRouter);
router.use(notificationsRouter);
router.use(priceTablesRouter);
router.use(paymentTermsRouter);

export default router;
