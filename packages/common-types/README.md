# @uda-strokeseg/common-types

Shared FE↔BE contracts. **Source of truth = Pydantic / FastAPI OpenAPI on `apps/server`.**

Regenerate after BE schema changes:
```
make gen-types
# or: npm run gen:types
```

Do not hand-edit enums to diverge from backend.
