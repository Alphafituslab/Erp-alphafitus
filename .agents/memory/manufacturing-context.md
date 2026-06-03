---
name: Manufacturing industry context
description: The company is a manufacturing industry — raw materials in, finished products out for sale. All ERP modules must reflect this flow.
---

The company is a **manufacturing industry** (indústria manufatureira):

- Receives raw materials (matéria-prima) from suppliers
- Transforms them through a production process into finished goods (produto acabado)
- Sells finished goods to customers

**Why:** User explicitly stated this on 2026-06-03 to ensure the ERP reflects the correct business model throughout all modules.

**How to apply:**
- Estoque: distinguish raw materials vs. finished goods stock where relevant
- Compras: purchasing is for raw materials/inputs, not resale goods
- Vendas: selling finished/manufactured products
- Produção/APS (planned): core transformation module
- All UI labels and descriptions should use manufacturing terminology (e.g. "matéria-prima", "produto acabado", "ordem de produção") where appropriate
