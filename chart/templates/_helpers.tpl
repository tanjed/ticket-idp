{{- define "idp.labels" -}}
app.kubernetes.io/name: idp
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "idp.domain" -}}
{{ required "domain is required (see helmvars/)" .Values.domain }}
{{- end }}

{{/* Public host of the login UI. Default login.<domain>. */}}
{{- define "idp.uiHost" -}}
{{ default (printf "login.%s" (include "idp.domain" .)) .Values.ui.host }}
{{- end }}

{{/* Fixed cluster-internal names: subchart values can't be templated and must reference them. */}}
{{- define "idp.uiName" -}}idp-ui{{- end }}
{{- define "idp.kratosExtraName" -}}idp-kratos-extra{{- end }}
{{- define "idp.hydraExtraName" -}}idp-hydra-extra{{- end }}

{{/* Public issuer URL of Hydra: https://idp.<domain>/ */}}
{{- define "idp.issuer" -}}
https://idp.{{ include "idp.domain" . }}/
{{- end }}
