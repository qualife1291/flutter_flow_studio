const networkMethods = {
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'request',
  'fetch',
  'query',
  'mutate',
};
final networkReceiver = RegExp(
  r'(dio|http|client|graphql|supabase)',
  caseSensitive: false,
);
final logoutMethod = RegExp(
  r'^(logout|signOut|clearSession|revokeToken|forceLogout|onUnauthorized)$',
  caseSensitive: false,
);
