{{- define "idp.labels" -}}
app.kubernetes.io/name: idp
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "idp.domain" -}}
{{ required "domain is required (see helmvars/)" .Values.domain }}
{{- end }}
