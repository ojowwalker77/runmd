# Failing Test

This passes:

```bash
echo "ok"
```

This fails:

```bash
exit 1
```

This should be skipped in fail-fast:

```bash
echo "after failure"
```
