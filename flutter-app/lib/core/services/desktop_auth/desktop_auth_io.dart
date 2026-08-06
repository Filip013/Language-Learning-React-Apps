import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

Future<UserCredential?> signInWithGoogleWindows(FirebaseAuth auth) async {
  HttpServer? server;
  try {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 51730);
    const authUrl = 'https://lingo-hub-nine.vercel.app/desktop-auth?source=tauri';
    await openWindowsBrowser(authUrl);

    await for (final request in server) {
      final token = request.uri.queryParameters['token'];
      if (token != null && token.isNotEmpty) {
        request.response.headers.contentType = ContentType.html;
        request.response.write('''
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; background: #09090b; color: #ffffff;">
              <h2>✓ Signed in successfully!</h2>
              <p style="color: #a1a1aa;">You can close this tab and return to Language Hub.</p>
              <script>setTimeout(() => window.close(), 1200);</script>
            </body>
          </html>
        ''');
        await request.response.close();
        await server.close();

        final credential = GoogleAuthProvider.credential(idToken: token.trim());
        return await auth.signInWithCredential(credential);
      } else {
        request.response.statusCode = HttpStatus.badRequest;
        request.response.write('Token missing');
        await request.response.close();
      }
    }
  } catch (e) {
    debugPrint('Windows Google Auth Server error: $e');
    rethrow;
  } finally {
    await server?.close();
  }
  return null;
}

Future<void> openWindowsBrowser(String url) async {
  try {
    await Process.run('cmd', ['/c', 'start', '', url]);
  } catch (_) {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}
