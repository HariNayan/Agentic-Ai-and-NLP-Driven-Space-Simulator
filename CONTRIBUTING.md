# Contributing to Space Monitor

Thanks for your interest in contributing! 🛰️

## How to Contribute

### 🐛 Report Bugs
Open an issue with:
- Steps to reproduce
- Browser/OS versions
- Console errors (if any)

### 💡 Suggest Features
Open an issue describing the feature and use case.

### 🔧 Submit Code

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make changes
4. Run tests:
   ```bash
   cd frontend && npx vitest run
   cd backend && python -m pytest tests/
   ```
5. Ensure frontend builds: `cd frontend && npm run build`
6. Commit and push
7. Open a Pull Request

## Code Style

- No comments in source code
- Monospace aesthetic — keep UI consistent
- TypeScript strict mode — no `any` unless unavoidable
- Python async/await for all I/O

## Adding a New API Panel

1. Create proxy route in `frontend/src/app/api/<name>/route.ts`
2. Create panel component in `frontend/src/components/panels/<Name>Panel.tsx`
3. Import and add to grid in `frontend/src/app/page.tsx`
4. Add tests for error/loading/empty states

## Project Structure

```
backend/    → FastAPI (agents, memory, curriculum)
frontend/   → Next.js (3D scene, panels, chat, store)
```

## License

By contributing, you agree that your contributions will be licensed under the same terms as this project.
