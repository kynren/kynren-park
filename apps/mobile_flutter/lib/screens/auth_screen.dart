import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/auth.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/managed_image.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _login = false;
  final _name = TextEditingController(), _email = TextEditingController(), _password = TextEditingController();
  bool _showPw = false, _loading = false;
  String _error = '';

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = '');
    final email = _email.text.trim();
    if (email.isEmpty || _password.text.length < 8) {
      setState(() => _error = 'Enter an email and a password of at least 8 characters.');
      return;
    }
    final auth = context.read<AuthState>();
    setState(() => _loading = true);
    try {
      if (_login) {
        await auth.login(email, _password.text);
      } else {
        await auth.register(email, _password.text, name: _name.text.trim().isEmpty ? null : _name.text.trim());
      }
      if (!mounted) return;
      if (!_login) {
        // New accounts are offered their bookings straight away.
        context.go('/find-bookings?email=${Uri.encodeQueryComponent(email)}&setup=1');
        return;
      }
      context.canPop() ? context.pop() : context.go('/');
    } catch (_) {
      setState(() => _error = _login ? 'Invalid email or password.' : 'Could not create your account (email may already exist).');
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return KScreen(
      title: _login ? 'Sign in' : 'Create account',
      subtitle: _login ? 'Welcome back to the park' : 'Keep your tickets and plans in one place',
      page: 'auth',
      children: [
        const SizedBox(height: 150, child: ClipRRect(borderRadius: BorderRadius.all(Radius.circular(20)), child: ManagedImage(slot: 'auth.header'))),
        Text(_login ? 'Sign in to see your tickets and save your day.' : 'So we can hold your tickets and remind you before each show.', style: TextStyle(fontSize: 14.5, height: 21 / 14.5, color: c.sub)),
        if (!_login) KTextField(label: 'Name (optional)', hint: 'Your name', controller: _name, capitalization: TextCapitalization.words),
        KTextField(label: 'Email', hint: 'you@example.com', controller: _email, keyboardType: TextInputType.emailAddress),
        KTextField(
          label: 'Password',
          hint: 'At least 8 characters',
          controller: _password,
          obscure: !_showPw,
          trailing: Tap(onTap: () => setState(() => _showPw = !_showPw), child: Text(_showPw ? 'Hide' : 'Show', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: c.link))),
        ),
        if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Tokens.danger, fontSize: 13.5, fontWeight: FontWeight.w600)),
        KButton(_login ? 'Sign in' : 'Create account', full: true, loading: _loading, onPressed: _submit),
        Tap(
          onTap: () => setState(() => _login = !_login),
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Center(child: Text(_login ? 'New here? Create an account' : 'Already have an account? Sign in', style: TextStyle(fontWeight: FontWeight.w700, color: c.link)))),
        ),
      ],
    );
  }
}
