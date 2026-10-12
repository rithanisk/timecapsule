import { Router, type IRouter } from "express";
import healthRouter from "./health";
import boothsRouter from "./booths";

const router: IRouter = Router();

router.use(healthRouter);
router.use(boothsRouter);

export default router;
